import { ensureSchema, getPool } from "./db";
import { checkPassword } from "./admin-auth";

const PBKDF2_ITERATIONS = 150_000;

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
}

/** Format: pbkdf2$<iterations>$<salt-b64url>$<hash-b64url> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(bits)}`;
}

async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64Url(parts[2]);
  const expectedHash = fromBase64Url(parts[3]);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const candidateHash = new Uint8Array(bits);
  if (candidateHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidateHash.length; i++) diff |= candidateHash[i] ^ expectedHash[i];
  return diff === 0;
}

export async function getStoredPasswordHash(): Promise<string | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{ password_hash: string | null }>(
    "SELECT password_hash FROM admin_settings WHERE id = 1"
  );
  return rows[0]?.password_hash ?? null;
}

export async function setStoredPasswordHash(hash: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO admin_settings (id, password_hash)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [hash]
  );
}

/** Checks a candidate against the admin password — the DB override once one
 *  has been set from the UI, otherwise the ADMIN_PASSWORD environment
 *  variable (the original, still-supported way to configure it). */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const storedHash = await getStoredPasswordHash();
  if (storedHash) return verifyPasswordHash(candidate, storedHash);
  return checkPassword(candidate);
}
