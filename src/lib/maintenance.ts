export const MAINTENANCE_BYPASS_COOKIE = "africakani_maintenance_bypass";
const BYPASS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const BYPASS_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // seconds, for the Set-Cookie header

export function isMaintenanceModeEnabled(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

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

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time comparison to avoid leaking the bypass key via timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkBypassKey(candidate: string | null): boolean {
  const expected = process.env.MAINTENANCE_BYPASS_KEY;
  if (!expected || !candidate) return false;
  return constantTimeEquals(candidate, expected);
}

/** Signs a short-lived-ish bypass token with MAINTENANCE_BYPASS_KEY as the HMAC secret. */
export async function createBypassToken(): Promise<string | null> {
  const secret = process.env.MAINTENANCE_BYPASS_KEY;
  if (!secret) return null;
  const payload = JSON.stringify({ exp: Date.now() + BYPASS_DURATION_MS });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  return `${payloadB64}.${toBase64Url(signature)}`;
}

export async function verifyBypassToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.MAINTENANCE_BYPASS_KEY;
  if (!secret) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64) as BufferSource,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64))
    ) as { exp: number };
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}
