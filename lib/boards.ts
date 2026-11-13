import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PERSON_COLORS, type BoardRole, type BoardState, type Person } from "@/lib/board-types";

const { board, boardMember, view, widget, user } = schema;

/** Vue de départ d'un nouveau board. */
const STARTER_WIDGETS: { type: string; x: number; y: number; w: number; h: number; showTitle: boolean; options: Record<string, string> }[] = [
  { type: "clock", x: 0, y: 0, w: 3, h: 2, showTitle: false, options: { secs: "off", weather: "on", unit: "C" } },
  { type: "calendar", x: 3, y: 0, w: 9, h: 2, showTitle: true, options: { view: "week" } },
  { type: "chores", x: 0, y: 2, w: 3, h: 3, showTitle: true, options: { who: "all" } },
  { type: "school", x: 3, y: 2, w: 6, h: 3, showTitle: true, options: { who: "all", span: "2j" } },
  { type: "shopping", x: 9, y: 2, w: 3, h: 3, showTitle: true, options: { done: "show" } },
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
    // Le board rejoint le plus récemment : quand on ajoute quelqu'un au board
    // familial, c'est celui-là qu'il voit, même s'il avait déjà le sien.
    .orderBy(desc(boardMember.createdAt), asc(board.id))
    .limit(1);
}

/**
 * Le board à afficher pour cet utilisateur. Tant qu'il n'y a pas de liste de
 * boards dans l'interface, c'est le dernier qu'il a rejoint ; s'il n'en a
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

/** Les personnes du board, dans l'ordre où elles l'ont rejoint. */
export async function listPeople(boardId: string): Promise<Person[]> {
  const rows = await db
    .select({ userId: user.id, name: user.name, role: boardMember.role, color: boardMember.color })
    .from(boardMember)
    .innerJoin(user, eq(user.id, boardMember.userId))
    .where(eq(boardMember.boardId, boardId))
    .orderBy(asc(boardMember.createdAt), asc(user.id));
  // Sans couleur choisie, chacun reçoit une couleur différente de la palette.
  return rows.map((r, i) => ({ ...r, color: r.color ?? PERSON_COLORS[i % PERSON_COLORS.length] }));
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
