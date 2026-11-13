"use server";

import { and, asc, count, eq, isNull, notInArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getRole, loadBoardView } from "@/lib/boards";
import { db, schema } from "@/lib/db";
import { GRID_COLS, PERSON_COLORS, type BoardRole, type BoardState, type DataItem } from "@/lib/board-types";
import type { CalendarResult } from "@/lib/calendar";
import { loadCalendarEvents } from "@/lib/calendar-server";
import { decryptSecret } from "@/lib/crypto";
import { policyFor, redact } from "@/lib/data-policy";

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

/** La vue du board telle qu'elle est enregistrée : sert à suivre les changements faits sur un autre appareil. */
export async function getBoardView(boardId: string): Promise<BoardState> {
  await requireRole(boardId, "member");
  return loadBoardView(boardId);
}

/**
 * Réglages qu'un simple membre peut changer en utilisant le widget (et non en
 * le configurant) : par exemple passer l'emploi du temps de « jours » à
 * « semaine ». Le changement vaut pour tous les appareils du board.
 */
const USAGE_OPTIONS: Record<string, Record<string, string[]>> = {
  school: { span: ["2j", "week"] },
  calendar: { view: ["month", "week", "day", "list"] },
};

export async function setWidgetOption(boardId: string, widgetId: string, key: string, value: string): Promise<void> {
  await requireRole(boardId, "member");
  if (!UUID.test(widgetId)) throw new Error("Widget inconnu.");
  const [found] = await db
    .select({ id: widget.id, type: widget.type, options: widget.options })
    .from(widget)
    .innerJoin(view, eq(view.id, widget.viewId))
    .where(and(eq(widget.id, widgetId), eq(view.boardId, boardId), isNull(view.userId)));
  if (!found) throw new Error("Widget inconnu.");
  if (!USAGE_OPTIONS[found.type]?.[key]?.includes(value)) throw new Error("Réglage non autorisé.");
  await db.update(widget).set({ options: { ...found.options, [key]: value } }).where(eq(widget.id, widgetId));
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

/* ------------------------------------------------------------------ */
/* Données des widgets                                                 */
/* ------------------------------------------------------------------ */

/** Les types de widget qui affichent cette liste sur le board (aucun = liste inconnue). */
async function typesOfList(boardId: string, dataId: string): Promise<string[]> {
  if (!UUID.test(dataId)) return [];
  const found = await db
    .select({ type: widget.type })
    .from(widget)
    .innerJoin(view, eq(view.id, widget.viewId))
    .where(and(eq(view.boardId, boardId), eq(widget.dataId, dataId)));
  return found.map((w) => w.type);
}

/**
 * Vérifie que l'utilisateur connecté peut écrire dans cette liste, selon les
 * règles de son type de widget (lib/data-policy.ts).
 */
async function requireListWrite(boardId: string, dataId: string) {
  const access = await requireRole(boardId, "member");
  const types = await typesOfList(boardId, dataId);
  if (types.length === 0) throw new Error("Liste inconnue.");
  const policy = policyFor(types);
  if (policy.adminWrite && access.role !== "admin") throw new Error("Réservé aux administrateurs du board.");
  return { ...access, policy };
}

function checkContent(content: unknown): Record<string, unknown> {
  if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("Contenu invalide.");
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) throw new Error("Contenu trop volumineux.");
  return content as Record<string, unknown>;
}

/** Les éléments d'une liste (membres et administrateurs), sans leurs champs secrets. */
export async function listItems(boardId: string, dataId: string): Promise<DataItem[]> {
  await requireRole(boardId, "member");
  const types = await typesOfList(boardId, dataId);
  if (types.length === 0) return [];
  const policy = policyFor(types);
  const rows = await db
    .select({ id: dataItem.id, content: dataItem.content })
    .from(dataItem)
    .where(and(eq(dataItem.boardId, boardId), eq(dataItem.dataId, dataId)))
    .orderBy(asc(dataItem.position), asc(dataItem.createdAt));
  return rows.map((r) => ({ id: r.id, content: redact(policy, r.content) }));
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
  const { user, policy } = await requireListWrite(boardId, dataId);
  const checked = checkContent(content);
  const [created] = await db
    .insert(dataItem)
    .values({
      boardId,
      dataId,
      content: policy.prepare ? policy.prepare(checked, null) : checked,
      createdBy: user.id,
      // Ajout en fin de liste.
      position: sql`(select coalesce(max(${dataItem.position}), 0) + 1 from ${dataItem} where ${dataItem.boardId} = ${boardId} and ${dataItem.dataId} = ${dataId})`,
    })
    .returning({ id: dataItem.id, content: dataItem.content });
  return { id: created.id, content: redact(policy, created.content) };
}

/** L'élément existant et le droit d'y écrire. */
async function requireItemWrite(boardId: string, itemId: string) {
  if (!UUID.test(boardId) || !UUID.test(itemId)) throw new Error("Élément inconnu.");
  const [item] = await db
    .select({ dataId: dataItem.dataId, content: dataItem.content })
    .from(dataItem)
    .where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
  if (!item) throw new Error("Élément inconnu.");
  const access = await requireListWrite(boardId, item.dataId);
  return { ...access, item };
}

export async function updateItem(boardId: string, itemId: string, content: unknown): Promise<void> {
  const { policy, item } = await requireItemWrite(boardId, itemId);
  const checked = checkContent(content);
  await db
    .update(dataItem)
    .set({ content: policy.prepare ? policy.prepare(checked, item.content) : checked, updatedAt: new Date() })
    .where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
}

export async function deleteItem(boardId: string, itemId: string): Promise<void> {
  await requireItemWrite(boardId, itemId);
  await db.delete(dataItem).where(and(eq(dataItem.id, itemId), eq(dataItem.boardId, boardId)));
}

/* ------------------------------------------------------------------ */
/* Calendrier                                                          */
/* ------------------------------------------------------------------ */

const MAX_RANGE_DAYS = 100;

/**
 * Les événements des agendas d'un widget Calendrier sur une période. Les
 * liens des agendas sont déchiffrés et lus ici, côté serveur : ils ne
 * quittent jamais le serveur.
 */
export async function getCalendarEvents(boardId: string, dataId: string, fromIso: string, toIso: string): Promise<CalendarResult> {
  await requireRole(boardId, "member");
  const types = await typesOfList(boardId, dataId);
  if (!types.includes("calendar")) return { events: [], errors: [] };

  const from = new Date(fromIso);
  const to = new Date(toIso);
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0 || days > MAX_RANGE_DAYS) throw new Error("Période invalide.");

  const sources = await db
    .select({ id: dataItem.id, content: dataItem.content })
    .from(dataItem)
    .where(and(eq(dataItem.boardId, boardId), eq(dataItem.dataId, dataId)));

  const result: CalendarResult = { events: [], errors: [] };
  await Promise.all(
    sources.map(async (source) => {
      try {
        const url = decryptSecret(String(source.content.url ?? ""));
        result.events.push(...(await loadCalendarEvents(source.id, url, from, to)));
      } catch (err) {
        // Le message ne contient jamais le lien.
        const message = err instanceof Error && !/https?:/i.test(err.message) ? err.message : "Agenda illisible.";
        result.errors.push({ sourceId: source.id, message });
      }
    })
  );
  return result;
}
