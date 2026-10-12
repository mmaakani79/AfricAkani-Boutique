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
