// What the shipping banner announces. Pure (no React, no DB): the figures come
// only from the shipping rules held in Réglages — the same source as the cart's
// shipping calculation — and are never invented. If those rules are not
// available, the banner says nothing numerical.

import { ZONES, formatPrice } from "@/data/zones";
import type { ShippingSettings } from "./shipping-types";
import type { ZoneId } from "./types";

export interface BannerItem {
  zoneId: ZoneId;
  /** "Bénin & Afrique de l'Ouest", "Canada", "États-Unis". */
  label: string;
  /** The free-shipping threshold, formatted in the zone's currency. */
  amount: string;
  /** The visitor's own zone: shown first and highlighted. */
  primary: boolean;
}

const ZONE_ORDER: ZoneId[] = ["bj", "ca", "us"];

/** Shown when Réglages could not be read (or has not answered yet): no figure. */
export const NEUTRAL_MESSAGE = "Livraison offerte dès un certain montant d'achat";

/** The visitor's zone first, then the others; a zone whose threshold is missing
 *  or not a positive number is left out rather than shown wrong. Empty when the
 *  live rules are unavailable. */
export function bannerItems(
  zoneId: ZoneId,
  live: Record<ZoneId, ShippingSettings> | null
): BannerItem[] {
  if (!live) return [];
  const ordered = [zoneId, ...ZONE_ORDER.filter((z) => z !== zoneId)];
  const items: BannerItem[] = [];
  for (const id of ordered) {
    const threshold = live[id]?.freeShippingThreshold;
    if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) continue;
    items.push({
      zoneId: id,
      label: ZONES[id].label,
      amount: formatPrice(threshold, id),
      primary: id === zoneId,
    });
  }
  return items;
}

/** The same announcement as one plain sentence, for tests and screen readers. */
export function bannerPlainText(items: BannerItem[]): string {
  if (items.length === 0) return NEUTRAL_MESSAGE;
  return items
    .map((item) =>
      item.primary
        ? `Livraison offerte dès ${item.amount} d'achat — ${item.label}`
        : `${item.label} : dès ${item.amount}`
    )
    .join(" • ");
}

/** Shown on the home page's "Livraison gratuite" card when the zone's threshold
 *  can't be read from Réglages: no figure, never an invented one. */
export const CARD_NEUTRAL_TEXT = "Dès le seuil de votre zone";

/** The sub-title of that card: the visitor's own zone threshold ("Dès 20 000 FCFA"). */
export function freeShippingCardText(
  zoneId: ZoneId,
  live: Record<ZoneId, ShippingSettings> | null
): string {
  const own = bannerItems(zoneId, live).find((item) => item.primary);
  return own ? `Dès ${own.amount}` : CARD_NEUTRAL_TEXT;
}

/** Fallback wording for every place that mentions free shipping: no figure. */
export const FREE_SHIPPING_NEUTRAL_TEXT = "Livraison gratuite dès le seuil de votre zone";

/** "Livraison gratuite dès 20 000 FCFA" — footer link and mobile menu. The
 *  threshold is the visitor's own zone one, read from Réglages; without it the
 *  wording stays neutral (never a figure written in the code). */
export function freeShippingLineText(
  zoneId: ZoneId,
  live: Record<ZoneId, ShippingSettings> | null
): string {
  const own = bannerItems(zoneId, live).find((item) => item.primary);
  return own ? `Livraison gratuite dès ${own.amount}` : FREE_SHIPPING_NEUTRAL_TEXT;
}

/** Same line on a product page, with the zone's name: "… dès 50,00 CAD d’achat (Canada)". */
export function freeShippingProductText(
  zoneId: ZoneId,
  live: Record<ZoneId, ShippingSettings> | null,
  zoneLabel: string
): string {
  const own = bannerItems(zoneId, live).find((item) => item.primary);
  return own
    ? `Livraison gratuite dès ${own.amount} d\u2019achat (${zoneLabel})`
    : `${FREE_SHIPPING_NEUTRAL_TEXT} (${zoneLabel})`;
}
