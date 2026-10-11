// What the browser is allowed to send when placing an order — and the
// validation of it. Pure (no DB, no React): shared by the checkout page (type
// only) and the server actions, and unit-tested.
//
// The browser sends choices (which product/variant, how many, which zone,
// who the customer is) and NEVER amounts. Any price, total, shipping fee or
// product name present in the payload is simply not read: the server prices
// the order itself (see order-pricing.ts).

import { ZONES } from "@/data/zones";
import type { ZoneId } from "./types";

/** Upper bound per cart line — far above any real order, low enough to refuse nonsense. */
export const MAX_QUANTITY_PER_LINE = 999;
/** Upper bound on distinct cart lines. */
export const MAX_ORDER_LINES = 50;

export interface DraftLine {
  productId: string;
  /** The chosen variant, for products that have variants. */
  variantId?: string | null;
  quantity: number;
}

export interface DraftCustomer {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  apartment?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface OrderDraft {
  id: string;
  zoneId: ZoneId;
  /** The currency the browser believes it is paying in. Never used to price
   *  anything — only compared with the zone's currency to catch a mismatch. */
  currency?: string;
  items: DraftLine[];
  customer: DraftCustomer;
  paymentMethod?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyPhone?: string | null;
  mobileMoneyTransactionId?: string | null;
}

/** The same draft once checked: only the fields the server accepts, typed. */
export interface ValidatedDraft {
  id: string;
  zoneId: ZoneId;
  lines: { productId: string; variantId: string | null; quantity: number }[];
  customer: DraftCustomer;
  wantsMobileMoney: boolean;
  mobileMoneyOperator: string | null;
  mobileMoneyPhone: string | null;
  mobileMoneyTransactionId: string | null;
}

export type ParseResult =
  | { ok: true; draft: ValidatedDraft }
  | { ok: false; error: string };

const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Own-property check, so "constructor" / "__proto__" never pass as a zone. */
export function isServedZone(value: unknown): value is ZoneId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ZONES, value);
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : undefined;
}

const INVALID_CUSTOMER = "Coordonnées invalides. Merci de vérifier le formulaire.";

export type CartParseResult =
  | { ok: true; zoneId: ZoneId; lines: ValidatedDraft["lines"] }
  | { ok: false; error: string };

/** The cart part of a request — zone, announced currency, lines — checked on
 *  its own, so the price check (no customer details yet) and the order itself
 *  apply exactly the same rules. */
export function parseCart(raw: unknown): CartParseResult {
  if (!isRecord(raw)) return { ok: false, error: "Commande invalide. Merci de réessayer." };

  if (!isServedZone(raw.zoneId)) {
    return { ok: false, error: "Cette zone de livraison n'est pas desservie." };
  }
  const zoneId = raw.zoneId;

  // The browser only announces its currency so a mismatch can be refused;
  // the amount is always priced in the zone's own currency.
  if (raw.currency !== undefined && raw.currency !== ZONES[zoneId].currency) {
    return {
      ok: false,
      error: `Devise incohérente avec la zone choisie (${ZONES[zoneId].currency} attendu). Merci de recharger la page.`,
    };
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { ok: false, error: "Votre panier est vide." };
  }
  if (raw.items.length > MAX_ORDER_LINES) {
    return {
      ok: false,
      error: `Votre panier contient trop de lignes (maximum ${MAX_ORDER_LINES}).`,
    };
  }

  const lines: ValidatedDraft["lines"] = [];
  for (const item of raw.items) {
    if (!isRecord(item) || typeof item.productId !== "string" || item.productId === "") {
      return { ok: false, error: "Un produit de votre panier est invalide. Retirez-le puis réessayez." };
    }
    const variantId =
      item.variantId === undefined || item.variantId === null || item.variantId === ""
        ? null
        : typeof item.variantId === "string"
          ? item.variantId
          : undefined;
    if (variantId === undefined) {
      return { ok: false, error: "Une variante de votre panier est invalide. Retirez-la puis réessayez." };
    }
    const quantity = item.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_LINE
    ) {
      return {
        ok: false,
        error: `Quantité invalide : choisissez un nombre entier entre 1 et ${MAX_QUANTITY_PER_LINE}.`,
      };
    }
    lines.push({ productId: item.productId, variantId, quantity });
  }

  return { ok: true, zoneId, lines };
}

export function parseOrderDraft(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, error: "Commande invalide. Merci de réessayer." };

  if (typeof raw.id !== "string" || !ORDER_ID_PATTERN.test(raw.id)) {
    return { ok: false, error: "Numéro de commande invalide. Merci de recharger la page." };
  }

  const cart = parseCart(raw);
  if (!cart.ok) return cart;
  const { zoneId, lines } = cart;

  if (!isRecord(raw.customer)) return { ok: false, error: INVALID_CUSTOMER };
  const c = raw.customer;
  for (const key of ["name", "email", "phone", "address", "city"] as const) {
    if (typeof c[key] !== "string") return { ok: false, error: INVALID_CUSTOMER };
  }
  const apartment = optionalString(c.apartment);
  const province = optionalString(c.province);
  const postalCode = optionalString(c.postalCode);
  const country = optionalString(c.country);
  if ([apartment, province, postalCode, country].some((v) => v === undefined)) {
    return { ok: false, error: INVALID_CUSTOMER };
  }
  const customer: DraftCustomer = {
    name: c.name as string,
    email: c.email as string,
    phone: c.phone as string,
    address: c.address as string,
    city: c.city as string,
    apartment,
    province,
    postalCode,
    country,
  };

  const mmOperator = optionalString(raw.mobileMoneyOperator);
  const mmPhone = optionalString(raw.mobileMoneyPhone);
  const mmTransactionId = optionalString(raw.mobileMoneyTransactionId);
  if ([mmOperator, mmPhone, mmTransactionId].some((v) => v === undefined)) {
    return { ok: false, error: "Informations Mobile Money invalides." };
  }

  return {
    ok: true,
    draft: {
      id: raw.id,
      zoneId,
      lines,
      customer,
      wantsMobileMoney: raw.paymentMethod === "mobile_money",
      mobileMoneyOperator: mmOperator ?? null,
      mobileMoneyPhone: mmPhone ?? null,
      mobileMoneyTransactionId: mmTransactionId ?? null,
    },
  };
}
