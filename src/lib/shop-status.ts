// "Interrupteur" of the shops AkaGest builds for clients. The status of each client shop is kept
// in AfricAkani's admin; the shop asks for it and shows a neutral "temporarily unavailable" page
// when it is suspended. Pure (no database, no React): the rules, the signature, and the decision a
// client shop takes. The client shop template copies `decideShopOpen` as it is.
//
//  - Status changes are manual only, a suspension needs a reason, everything is journaled.
//  - Data is kept 6 months after a suspension before the shop can be marked deleted.
//  - The answer of the status address is signed (HMAC-SHA256 with a key derived for that shop), so
//    nobody can close a shop by forging an answer. A missing, late, malformed or wrongly signed
//    answer NEVER closes a shop: when AfricAkani cannot be reached, the shop stays open.

import { createHmac, timingSafeEqual } from "node:crypto";
import { addMonths } from "./service-validation";

export type ShopStatus = "actif" | "en_retard" | "suspendu" | "supprime";
export const SHOP_STATUSES: readonly ShopStatus[] = ["actif", "en_retard", "suspendu", "supprime"];

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  actif: "Actif",
  en_retard: "En retard",
  suspendu: "Suspendu",
  supprime: "Supprimé",
};

/** Months the data is kept after a suspension before the shop can be marked as deleted. */
export const RETENTION_MONTHS = 6;

export function deleteAfterDate(suspendedOn: string): string {
  return addMonths(suspendedOn, RETENTION_MONTHS);
}

/** "https://Boutique.exemple.com/x" → "boutique.exemple.com"; "" when empty; null when it is not a domain name. */
export function cleanDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!value) return "";
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value) ? value : null;
}

/** Why a status change is refused (French message), or null when it is allowed. */
export function transitionError(
  from: ShopStatus,
  to: ShopStatus,
  context: { reason: string; deleteAfter: string | null; today: string }
): string | null {
  if (from === to) return "La boutique est déjà dans cet état.";
  if (from === "supprime") return "Une boutique supprimée ne peut plus changer d'état.";
  const reason = context.reason.trim();

  if (to === "suspendu") {
    if (from !== "actif" && from !== "en_retard") return "Seule une boutique active ou en retard peut être suspendue.";
    if (!reason) return "Indiquez le motif de la suspension : il est gardé dans le journal.";
    return null;
  }
  if (to === "actif") return null; // reactivation (from "suspendu" or "en_retard"): one click, reason optional
  if (to === "en_retard") {
    return from === "actif" ? null : "Seule une boutique active peut être marquée « en retard ».";
  }
  // to === "supprime"
  if (from !== "suspendu") return "Suspendez d'abord la boutique : la suppression ne vient qu'après la période de conservation.";
  if (!context.deleteAfter) return "Date de suppression introuvable pour cette boutique.";
  if (context.today < context.deleteAfter) {
    return `Les données sont conservées ${RETENTION_MONTHS} mois : la suppression est possible à partir du ${context.deleteAfter}.`;
  }
  if (!reason) return "Indiquez le motif de la suppression : il est gardé dans le journal.";
  return null;
}

// ---- The signed status answer ----------------------------------------------------------------

export type ApiShopStatus = "active" | "late" | "suspended" | "deleted";

const API_STATUS: Record<ShopStatus, ApiShopStatus> = {
  actif: "active",
  en_retard: "late",
  suspendu: "suspended",
  supprime: "deleted",
};
export const toApiStatus = (status: ShopStatus): ApiShopStatus => API_STATUS[status];

const API_STATUSES = new Set<string>(Object.values(API_STATUS));

/** The key a given shop uses to check answers, derived from AfricAkani's secret: nothing extra to store. */
export function deriveShopKey(secret: string, publicKey: string): string {
  return createHmac("sha256", secret).update(`shop-status-key:v1:${publicKey}`).digest("hex");
}

function payload(publicKey: string, status: string, ts: number): string {
  return `v1.${publicKey}.${status}.${ts}`;
}

export interface ShopStatusAnswer {
  shop: string;
  status: ApiShopStatus;
  /** Seconds since 1970 when the answer was produced. */
  ts: number;
  signature: string;
}

export function signShopStatus(shopKey: string, publicKey: string, status: ApiShopStatus, ts: number): ShopStatusAnswer {
  const signature = createHmac("sha256", shopKey).update(payload(publicKey, status, ts)).digest("hex");
  return { shop: publicKey, status, ts, signature };
}

/** True only for a well-formed answer, for this shop, signed with this shop's key, not older than `maxAgeSeconds`. */
export function verifyShopStatus(
  answer: unknown,
  shopKey: string,
  publicKey: string,
  now: number = Date.now() / 1000,
  maxAgeSeconds = 600
): answer is ShopStatusAnswer {
  if (!answer || typeof answer !== "object") return false;
  const a = answer as Partial<ShopStatusAnswer>;
  if (a.shop !== publicKey || typeof a.status !== "string" || !API_STATUSES.has(a.status)) return false;
  if (typeof a.ts !== "number" || !Number.isFinite(a.ts) || typeof a.signature !== "string") return false;
  if (Math.abs(now - a.ts) > maxAgeSeconds) return false;
  const expected = createHmac("sha256", shopKey).update(payload(publicKey, a.status, a.ts)).digest();
  let given: Buffer;
  try {
    given = Buffer.from(a.signature, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * What a client shop does with the answer it got (or did not get): `false` ONLY for a valid, fresh,
 * signed "suspended" or "deleted". Anything else — "active", "late", no answer, an error, a forged or
 * stale answer — keeps the shop open: AfricAkani being unreachable must never close a shop.
 */
export function decideShopOpen(
  answer: unknown,
  shopKey: string,
  publicKey: string,
  now: number = Date.now() / 1000
): boolean {
  if (!verifyShopStatus(answer, shopKey, publicKey, now)) return true;
  return answer.status !== "suspended" && answer.status !== "deleted";
}
