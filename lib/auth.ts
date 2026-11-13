import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { createAuth } from "@/lib/auth-core";

export const auth = createAuth([nextCookies()]);

/** L'utilisateur connecté, ou null. À appeler côté serveur. */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
