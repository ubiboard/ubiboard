"use server";

import { and, asc, count, eq, isNull, notInArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getRole } from "@/lib/boards";
import { db, schema } from "@/lib/db";
import { GRID_COLS, PERSON_COLORS, type BoardRole, type BoardState, type DataItem } from "@/lib/board-types";

const { view, widget, dataItem, boardMember } = schema;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WIDGETS = 60;
const MAX_CONTENT_BYTES = 10_000;

/**
 * Vérifie que l'utilisateur connecté a au moins ce rôle sur le board.
 * Toutes les actions passent par ici : c'est le seul endroit où les droits se décident.
 */
async function requireRole(boardId: string, needed: BoardRole) {
  if (!UUID.test(boardId)) throw new Error("Board inconnu.");
  const user = await getCurrentUser();
  if (!user) throw new Error("Vous n'êtes pas connecté.");
  const role = await getRole(boardId, user.id);
  if (!role) throw new Error("Vous n'avez pas accès à ce board.");
  if (needed === "admin" && role !== "admin") throw new Error("Réservé aux administrateurs du board.");
  return { user, role };
}

const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** Enregistre la vue du board (administrateurs seulement). */
export async function saveBoardView(boardId: string, state: BoardState): Promise<void> {
  await requireRole(boardId, "admin");

  if (!Array.isArray(state?.widgets) || state.widgets.length > MAX_WIDGETS) throw new Error("Vue invalide.");
  const rows = state.widgets.map((w) => {
    const cell = state.layout.find((l) => l.i === w.id);
    const optionsOk =
      w.options && typeof w.options === "object" && Object.values(w.options).every((v) => typeof v === "string");
    if (
      !cell ||
      !UUID.test(w.id) ||
      !UUID.test(w.dataId) ||
      typeof w.type !== "string" ||
      w.type.length > 60 ||
      !optionsOk ||
      !isInt(cell.w, 1, GRID_COLS) ||
      !isInt(cell.h, 1, 20) ||
      !isInt(cell.x, 0, GRID_COLS - cell.w) ||
      !isInt(cell.y, 0, 500)
    ) {
      throw new Error("Vue invalide.");
    }
    const title = typeof w.title === "string" ? w.title.trim().slice(0, 80) : "";
    return {
      id: w.id,
      type: w.type,
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      showTitle: !!w.showTitle,
      title: title || null,
      options: w.options,
      dataId: w.dataId,
    };
  });

  await db.transaction(async (tx) => {
    const [boardView] = await tx
      .select({ id: view.id })
      .from(view)
      .where(and(eq(view.boardId, boardId), isNull(view.userId)));
    if (!boardView) throw new Error("Vue introuvable.");

    await tx.delete(widget).where(eq(widget.viewId, boardView.id));
    if (rows.length > 0) await tx.insert(widget).values(rows.map((r) => ({ ...r, viewId: boardView.id })));
    await tx
      .update(view)
      .set({ settings: { dim: !!state.screen?.dim, drift: !!state.screen?.drift }, updatedAt: new Date() })
      .where(eq(view.id, boardView.id));

    // Une liste disparaît avec le dernier widget qui l'affiche, toutes vues confondues.
    const stillUsed = tx
      .select({ dataId: widget.dataId })
      .from(widget)
      .innerJoin(view, eq(view.id, widget.viewId))
      .where(eq(view.boardId, boardId));
    await tx.delete(dataItem).where(and(eq(dataItem.boardId, boardId), notInArray(dataItem.dataId, stillUsed)));
  });
}

/** Change la couleur d'une personne du board : un administrateur, ou la personne elle-même. */
export async function setPersonColor(boardId: string, userId: string, color: string): Promise<void> {
  const { user, role } = await requireRole(boardId, "member");
  if (role !== "admin" && user.id !== userId) throw new Error("Réservé aux administrateurs du board.");
  if (!PERSON_COLORS.includes(color)) throw new Error("Couleur inconnue.");
  await db
    .update(boardMember)
    .set({ color })
    .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, userId)));
}

/**
 * Types de widget dont les données ne sont modifiables que par les
 * administrateurs du board (les membres les lisent). Les autres listes sont
 * modifiables par tous les membres.
 */
const ADMIN_WRITE_TYPES = new Set(["chores"]);

/**
 * Vérifie que l'utilisateur connecté peut écrire dans cette liste, qui doit
 * être affichée par un widget du board.
 */
async function requireListWrite(boardId: string, dataId: string) {
  const access = await requireRole(boardId, "member");
  if (!UUID.test(dataId)) throw new Error("Liste inconnue.");
  const found = await db
    .select({ type: widget.type })
    .from(widget)
    .innerJoin(view, eq(view.id, widget.viewId))
    .where(and(eq(view.boardId, boardId), eq(widget.dataId, dataId)));
  if (found.length === 0) throw new Error("Liste inconnue.");
  if (access.role !== "admin" && found.some((w) => ADMIN_WRITE_TYPES.has(w.type))) {
    throw new Error("Réservé aux administrateurs du board.");
  }
  return access;
}

/** Même vérification, à partir d'un élément existant. */
async function requireItemWrite(boardId: string, itemId: string) {
  if (!UUID.test(boardId) || !UUID.test(itemId)) throw new Error("Élément inconnu.");
  const [item] = await db
    .select({ dataId: dataItem.dataId })
    .from(dataItem)
    .where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
  if (!item) throw new Error("Élément inconnu.");
  return requireListWrite(boardId, item.dataId);
}

function checkContent(content: unknown): Record<string, unknown> {
  if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("Contenu invalide.");
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) throw new Error("Contenu trop volumineux.");
  return content as Record<string, unknown>;
}

/** Les éléments d'une liste (membres et administrateurs). */
export async function listItems(boardId: string, dataId: string): Promise<DataItem[]> {
  await requireRole(boardId, "member");
  if (!UUID.test(dataId)) return [];
  return db
    .select({ id: dataItem.id, content: dataItem.content })
    .from(dataItem)
    .where(and(eq(dataItem.boardId, boardId), eq(dataItem.dataId, dataId)))
    .orderBy(asc(dataItem.position), asc(dataItem.createdAt));
}

/** Nombre d'éléments d'une liste : sert à prévenir avant de supprimer un widget. */
export async function countItems(boardId: string, dataId: string): Promise<number> {
  await requireRole(boardId, "member");
  if (!UUID.test(dataId)) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(dataItem)
    .where(and(eq(dataItem.boardId, boardId), eq(dataItem.dataId, dataId)));
  return row?.n ?? 0;
}

export async function addItem(boardId: string, dataId: string, content: unknown): Promise<DataItem> {
  const { user } = await requireListWrite(boardId, dataId);
  const [created] = await db
    .insert(dataItem)
    .values({
      boardId,
      dataId,
      content: checkContent(content),
      createdBy: user.id,
      // Ajout en fin de liste.
      position: sql`(select coalesce(max(${dataItem.position}), 0) + 1 from ${dataItem} where ${dataItem.boardId} = ${boardId} and ${dataItem.dataId} = ${dataId})`,
    })
    .returning({ id: dataItem.id, content: dataItem.content });
  return created;
}

export async function updateItem(boardId: string, itemId: string, content: unknown): Promise<void> {
  await requireItemWrite(boardId, itemId);
  await db
    .update(dataItem)
    .set({ content: checkContent(content), updatedAt: new Date() })
    .where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
}

export async function deleteItem(boardId: string, itemId: string): Promise<void> {
  await requireItemWrite(boardId, itemId);
  await db.delete(dataItem).where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
}
