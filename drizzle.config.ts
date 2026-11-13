import { defineConfig } from "drizzle-kit";

// Les migrations passent par la connexion directe (sans pooler) quand elle existe.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant : voir .env.example");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
