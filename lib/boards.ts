import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { BoardRole, BoardState } from "@/lib/board-types";

const { board, boardMember, view, widget } = schema;

/** Vue de départ d'un nouveau board. */
const STARTER_WIDGETS: { type: string; x: number; y: number; w: number; h: number; showTitle: boolean; options: Record<string, string> }[] = [
  { type: "clock", x: 0, y: 0, w: 2, h: 1, showTitle: false, options: { secs: "off" } },
  { type: "weather", x: 0, y: 1, w: 2, h: 1, showTitle: true, options: { unit: "C" } },
  { type: "calendar", x: 2, y: 0, w: 6, h: 2, showTitle: true, options: { who: "Tous" } },
  { type: "chores", x: 0, y: 2, w: 2, h: 3, showTitle: true, options: { who: "Tous" } },
  { type: "school", x: 2, y: 2, w: 4, h: 3, showTitle: true, options: { kid: "Léo", span: "2j" } },
  { type: "shopping", x: 6, y: 2, w: 2, h: 3, showTitle: true, options: { done: "show" } },
];

export type BoardAccess = { boardId: string; name: string; role: BoardRole };

/** Le rôle de l'utilisateur sur ce board, ou null s'il n'y a pas accès. */
export async function getRole(boardId: string, userId: string): Promise<BoardRole | null> {
  const [row] = await db
    .select({ role: boardMember.role })
    .from(boardMember)
    .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, userId)));
  return row?.role ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Crée un board privé : son créateur en est le premier administrateur. */
async function createBoardIn(tx: Tx, userId: string, name: string): Promise<BoardAccess> {
  const [created] = await tx
    .insert(board)
    .values({ name, createdBy: userId, publicToken: randomBytes(24).toString("base64url") })
    .returning({ id: board.id });
  await tx.insert(boardMember).values({ boardId: created.id, userId, role: "admin" });
  const [boardView] = await tx
    .insert(view)
    .values({ boardId: created.id, userId: null, settings: { dim: false, drift: true } })
    .returning({ id: view.id });
  await tx
    .insert(widget)
    .values(STARTER_WIDGETS.map((w) => ({ ...w, viewId: boardView.id, dataId: randomUUID() })));
  return { boardId: created.id, name, role: "admin" };
}

export function createBoard(userId: string, name: string): Promise<BoardAccess> {
  return db.transaction((tx) => createBoardIn(tx, userId, name));
}

function firstBoardOf(tx: Tx | typeof db, userId: string): Promise<BoardAccess[]> {
  return tx
    .select({ boardId: board.id, name: board.name, role: boardMember.role })
    .from(boardMember)
    .innerJoin(board, eq(board.id, boardMember.boardId))
    .where(eq(boardMember.userId, userId))
    .orderBy(asc(boardMember.createdAt), asc(board.id))
    .limit(1);
}

/**
 * Le board à afficher pour cet utilisateur. Tant qu'il n'y a pas de liste de
 * boards dans l'interface, c'est le premier auquel il a accès ; s'il n'en a
 * aucun, on lui en crée un.
 */
export async function getOrCreateHomeBoard(userId: string): Promise<BoardAccess> {
  const [first] = await firstBoardOf(db, userId);
  if (first) return first;

  // Deux pages chargées en même temps ne doivent pas créer deux boards : on
  // prend un verrou par utilisateur, puis on revérifie avant de créer.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [existing] = await firstBoardOf(tx, userId);
    return existing ?? createBoardIn(tx, userId, "Maison");
  });
}

/** La vue du board (celle qui est partagée par tous). */
export async function loadBoardView(boardId: string): Promise<BoardState> {
  const [boardView] = await db
    .select()
    .from(view)
    .where(and(eq(view.boardId, boardId), isNull(view.userId)));
  if (!boardView) return { widgets: [], layout: [], screen: { dim: false, drift: true } };

  const rows = await db.select().from(widget).where(eq(widget.viewId, boardView.id)).orderBy(asc(widget.y), asc(widget.x));
  return {
    widgets: rows.map((r) => ({
      id: r.id,
      type: r.type,
      showTitle: r.showTitle,
      title: r.title,
      options: r.options,
      dataId: r.dataId,
    })),
    layout: rows.map((r) => ({ i: r.id, x: r.x, y: r.y, w: r.w, h: r.h })),
    screen: boardView.settings,
  };
}
