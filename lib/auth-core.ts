import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db";

/**
 * Configuration des comptes, sans dépendance à Next.js : utilisée telle quelle
 * par les scripts (scripts/user.ts), et avec le plugin de cookies par l'appli
 * (lib/auth.ts).
 */
export function createAuth(plugins: BetterAuthPlugin[] = []) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Pas d'inscription publique : les comptes sont créés par commande
      // (npm run user:create).
      disableSignUp: true,
      minPasswordLength: 8,
    },
    plugins,
  });
}

export const auth = createAuth();
