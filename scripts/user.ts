/**
 * Gestion des comptes en ligne de commande (il n'y a pas d'inscription publique).
 *
 *   npm run user:create -- <identifiant> "<nom affiché>" [email]
 *   npm run user:password -- <identifiant ou email>
 *   npm run user:username -- <identifiant ou email> <nouvel identifiant>
 *   npm run user:list
 *
 * L'identifiant sert à se connecter (court, sans espace). L'adresse e-mail est
 * facultative : sans elle, le compte reçoit une adresse interne qui n'existe pas.
 * Le mot de passe est demandé au clavier, jamais passé en argument.
 */
import { createInterface } from "node:readline/promises";
import { eq, or } from "drizzle-orm";
import { MIN_PASSWORD_LENGTH, auth } from "../lib/auth-core";
import { db, schema } from "../lib/db";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,29}$/;

function checkUsername(value: string | undefined): string {
  const username = value?.trim().toLowerCase() ?? "";
  if (!USERNAME.test(username)) {
    throw new Error("Identifiant invalide : 2 à 30 caractères, lettres sans accent, chiffres, point, tiret.");
  }
  return username;
}

async function askPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = (await rl.question(`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum) : `)).trim();
  rl.close();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`);
  }
  return password;
}

/** Retrouve un compte par son identifiant ou son adresse e-mail. */
async function findAccount(key: string | undefined) {
  const value = key?.trim().toLowerCase();
  if (!value) throw new Error("Identifiant manquant.");
  const [found] = await db
    .select()
    .from(schema.user)
    .where(or(eq(schema.user.username, value), eq(schema.user.email, value)));
  if (!found) throw new Error(`Aucun compte pour « ${value} ».`);
  return found;
}

async function isTaken(username: string, email: string) {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(or(eq(schema.user.username, username), eq(schema.user.email, email)));
  return rows.length > 0;
}

async function main() {
  const [command, arg1, arg2, arg3] = process.argv.slice(2);
  const ctx = await auth.$context;

  if (command === "list") {
    const users = await db.select().from(schema.user);
    for (const u of users) console.log(`${(u.username ?? "(sans identifiant)").padEnd(20)} ${u.name.padEnd(20)} ${u.email}`);
    if (users.length === 0) console.log("Aucun compte.");
    return;
  }

  if (command === "create") {
    const username = checkUsername(arg1);
    const name = arg2?.trim() || username;
    const email = arg3?.trim().toLowerCase() || `${username}@ubiboard.invalid`;
    if (await isTaken(username, email)) throw new Error(`Un compte existe déjà pour « ${username} » ou ${email}.`);
    const hash = await ctx.password.hash(await askPassword());
    const created = await ctx.internalAdapter.createUser(
      { email, name, emailVerified: true, username, displayUsername: username },
      { method: "email-password" }
    );
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: hash,
    });
    console.log(`Compte créé : identifiant « ${username} », nom « ${name} ».`);
    return;
  }

  if (command === "password") {
    const account = await findAccount(arg1);
    const hash = await ctx.password.hash(await askPassword());
    await ctx.internalAdapter.updatePassword(account.id, hash);
    console.log(`Mot de passe modifié pour ${account.name}.`);
    return;
  }

  if (command === "username") {
    const account = await findAccount(arg1);
    const username = checkUsername(arg2);
    const [clash] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, username));
    if (clash && clash.id !== account.id) throw new Error(`L'identifiant « ${username} » est déjà pris.`);
    await db.update(schema.user).set({ username, displayUsername: username }).where(eq(schema.user.id, account.id));
    console.log(`${account.name} se connecte maintenant avec l'identifiant « ${username} ».`);
    return;
  }

  throw new Error("Commande inconnue. Utilisation : create | password | username | list");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
