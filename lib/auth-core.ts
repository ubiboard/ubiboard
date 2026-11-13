import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db, schema } from "./db";

/**
 * L'adresse publique de l'appli, dont Better Auth a besoin pour vérifier
 * l'origine des requêtes.
 *
 * - BETTER_AUTH_URL renseigné : on l'utilise tel quel (auto-hébergement).
 * - Sur Vercel : l'adresse est celle de la requête, parmi les domaines du
 *   déploiement (production, branche, aperçu).
 * - Sinon : développement local.
 */
function resolveBaseURL(): BetterAuthOptions["baseURL"] {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;

  const local = ["localhost:*", "127.0.0.1:*"];
  if (!process.env.VERCEL) {
    return { allowedHosts: local, fallback: "http://localhost:3000", protocol: "http" };
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const hosts = [production, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(
    (h): h is string => !!h
  );
  return {
    allowedHosts: [...hosts, "*.vercel.app"],
    fallback: production ? `https://${production}` : undefined,
    protocol: "https",
  };
}

export const MIN_PASSWORD_LENGTH = 6;

const DAY = 60 * 60 * 24;

/**
 * Configuration des comptes, sans dépendance à Next.js : utilisée telle quelle
 * par les scripts (scripts/user.ts), et avec le plugin de cookies par l'appli
 * (lib/auth.ts).
 */
export function createAuth(plugins: BetterAuthPlugin[] = []) {
  return betterAuth({
    baseURL: resolveBaseURL(),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Pas d'inscription publique : les comptes sont créés par commande
      // (npm run user:create).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    // Un écran mural ou un téléphone reste connecté : la session dure 90 jours
    // et se prolonge d'elle-même tant que l'appareil sert.
    session: { expiresIn: 90 * DAY, updateAge: DAY },
    // Connexion par identifiant court, en plus de l'adresse e-mail.
    plugins: [username({ minUsernameLength: 2 }), ...plugins],
  });
}

export const auth = createAuth();
