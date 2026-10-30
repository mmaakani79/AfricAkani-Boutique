import { createHash, randomBytes } from "node:crypto";

// The private link of a client is /paiement-service/<token>. The token is 256 random
// bits (not guessable); only its SHA-256 fingerprint is stored, so a copy of the
// database does not give access to any client page. It is shown once, when created
// (or regenerated), in the admin.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateServiceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashServiceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check done before any database lookup. */
export function isPlausibleServiceToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** A short random identifier such as "SV-7K3Q9XM2" (no look-alike characters). */
export function randomServiceId(prefix: string): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}
