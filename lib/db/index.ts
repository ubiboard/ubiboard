import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL manquant : voir .env.example");
}

// En développement, le rechargement à chaud recréerait une connexion à chaque
// modification : on garde le client sur l'objet global.
const globalForDb = globalThis as unknown as { __ubiboardSql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.__ubiboardSql ??
  postgres(url, {
    prepare: false, // requis derrière un pooler (Neon, pgbouncer)
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__ubiboardSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
