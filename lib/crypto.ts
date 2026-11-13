import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement des secrets stockés en base (liens d'agenda…).
 *
 * AES-256-GCM avec une clé qui n'est PAS dans la base : elle vient de la
 * variable d'environnement DATA_ENCRYPTION_KEY. Une copie de la base seule ne
 * permet donc pas de lire ces secrets.
 */

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) {
    throw new Error("Clé de chiffrement absente ou invalide (DATA_ENCRYPTION_KEY) : voir .env.example.");
  }
  return buf;
}

export const isEncrypted = (value: unknown): value is string => typeof value === "string" && value.startsWith(PREFIX);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) throw new Error("Secret illisible.");
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
