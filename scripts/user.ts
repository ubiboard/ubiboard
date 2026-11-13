/**
 * Gestion des comptes en ligne de commande (il n'y a pas d'inscription publique).
 *
 *   npm run user:create -- <email> "<nom affiché>"
 *   npm run user:password -- <email>
 *   npm run user:list
 *
 * Le mot de passe est demandé au clavier, jamais passé en argument.
 */
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth-core";
import { db, schema } from "../lib/db";

async function askPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = (await rl.question("Mot de passe (8 caractères minimum) : ")).trim();
  rl.close();
  if (password.length < 8) throw new Error("Mot de passe trop court (8 caractères minimum).");
  return password;
}

async function main() {
  const [command, emailArg, nameArg] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const ctx = await auth.$context;

  if (command === "list") {
    const users = await db.select().from(schema.user);
    for (const u of users) console.log(`${u.email}\t${u.name}`);
    if (users.length === 0) console.log("Aucun compte.");
    return;
  }

  if (!email) throw new Error("Adresse e-mail manquante.");
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email));

  if (command === "create") {
    if (existing) throw new Error(`Un compte existe déjà pour ${email}.`);
    const name = nameArg?.trim() || email.split("@")[0];
    const hash = await ctx.password.hash(await askPassword());
    const created = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "email-password" });
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: hash,
    });
    console.log(`Compte créé : ${email} (${name}).`);
    return;
  }

  if (command === "password") {
    if (!existing) throw new Error(`Aucun compte pour ${email}.`);
    const hash = await ctx.password.hash(await askPassword());
    await ctx.internalAdapter.updatePassword(existing.id, hash);
    console.log(`Mot de passe modifié pour ${email}.`);
    return;
  }

  throw new Error("Commande inconnue. Utilisation : create | password | list");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
