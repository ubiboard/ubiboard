/**
 * Gestion des boards en ligne de commande, en attendant l'écran de partage.
 *
 *   npm run board:list
 *   npm run board:add -- <email à ajouter> <email d'un administrateur du board> [membre|admin]
 *   npm run board:remove -- <email à retirer> <email d'un administrateur du board>
 *
 * Le board visé est celui que l'administrateur indiqué voit en se connectant.
 * La personne ajoutée doit déjà avoir un compte (npm run user:create).
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../lib/db";

const { user, board, boardMember } = schema;

async function findUser(email: string | undefined) {
  if (!email) throw new Error("Adresse e-mail manquante.");
  const [found] = await db.select().from(user).where(eq(user.email, email.trim().toLowerCase()));
  if (!found) throw new Error(`Aucun compte pour ${email}.`);
  return found;
}

/** Le board que cette personne voit en se connectant, à condition qu'elle en soit administratrice. */
async function boardOfAdmin(adminEmail: string | undefined) {
  const admin = await findUser(adminEmail);
  const [home] = await db
    .select({ id: board.id, name: board.name, role: boardMember.role })
    .from(boardMember)
    .innerJoin(board, eq(board.id, boardMember.boardId))
    .where(eq(boardMember.userId, admin.id))
    .orderBy(desc(boardMember.createdAt), asc(board.id))
    .limit(1);
  if (!home) throw new Error(`${admin.email} n'a pas encore de board : il se crée à sa première connexion.`);
  if (home.role !== "admin") throw new Error(`${admin.email} n'est pas administrateur du board « ${home.name} ».`);
  return home;
}

async function main() {
  const [command, emailArg, adminArg, roleArg] = process.argv.slice(2);

  if (command === "list") {
    const rows = await db
      .select({ boardId: board.id, board: board.name, email: user.email, name: user.name, role: boardMember.role })
      .from(boardMember)
      .innerJoin(board, eq(board.id, boardMember.boardId))
      .innerJoin(user, eq(user.id, boardMember.userId))
      .orderBy(asc(board.createdAt), asc(boardMember.createdAt));
    let current = "";
    for (const r of rows) {
      if (r.boardId !== current) {
        current = r.boardId;
        console.log(`\nBoard « ${r.board} »`);
      }
      console.log(`  ${r.role === "admin" ? "administrateur" : "membre        "}  ${r.name} <${r.email}>`);
    }
    if (rows.length === 0) console.log("Aucun board.");
    return;
  }

  if (command === "add") {
    const role = roleArg === "admin" ? "admin" : "member";
    if (roleArg && !["admin", "membre", "member"].includes(roleArg)) {
      throw new Error("Rôle inconnu : utiliser « membre » ou « admin ».");
    }
    const target = await boardOfAdmin(adminArg);
    const person = await findUser(emailArg);
    await db
      .insert(boardMember)
      .values({ boardId: target.id, userId: person.id, role })
      .onConflictDoUpdate({ target: [boardMember.boardId, boardMember.userId], set: { role } });
    console.log(`${person.name} est ${role === "admin" ? "administrateur" : "membre"} du board « ${target.name} ».`);
    return;
  }

  if (command === "remove") {
    const target = await boardOfAdmin(adminArg);
    const person = await findUser(emailArg);
    const removed = await db
      .delete(boardMember)
      .where(and(eq(boardMember.boardId, target.id), eq(boardMember.userId, person.id)))
      .returning({ userId: boardMember.userId });
    console.log(
      removed.length ? `${person.name} n'a plus accès au board « ${target.name} ».` : `${person.name} n'était pas sur ce board.`
    );
    return;
  }

  throw new Error("Commande inconnue. Utilisation : list | add | remove");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
