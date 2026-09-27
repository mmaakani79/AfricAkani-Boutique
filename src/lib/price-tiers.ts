// Pure quantity-pricing helpers — safe to import from client components
// (no DB import), shared by the cart, the product page, and the admin form.

import type { PriceTier, Product, ZoneId } from "./types";

/** All tiers for a zone, tier 1 (the base price) first, sorted ascending by
 *  minQty. Empty if the product isn't sold in that zone. */
export function tiersForZone(product: Product, zoneId: ZoneId): PriceTier[] {
  const base = product.prices[zoneId];
  if (base === null || base === undefined) return [];
  const extra = (product.priceTiers?.[zoneId] ?? [])
    .filter((t) => t.minQty > 1)
    .sort((a, b) => a.minQty - b.minQty);
  return [{ minQty: 1, price: base }, ...extra];
}

/** The applicable unit price for a given quantity — the highest tier whose
 *  minQty doesn't exceed it. null if the product isn't sold in that zone. */
export function priceForQuantity(
  product: Product,
  zoneId: ZoneId,
  quantity: number
): number | null {
  const tiers = tiersForZone(product, zoneId);
  if (tiers.length === 0) return null;
  let applicable = tiers[0];
  for (const tier of tiers) {
    if (tier.minQty <= quantity) applicable = tier;
    else break;
  }
  return applicable.price;
}

/** "1 - 9", "10 - 99", "100 et plus" — the quantity range a tier covers,
 *  bounded by the next tier's minQty (or open-ended for the last one). */
export function tierRangeLabel(tiers: PriceTier[], index: number): string {
  const tier = tiers[index];
  const next = tiers[index + 1];
  if (!next) return `${tier.minQty} et plus`;
  return `${tier.minQty} - ${next.minQty - 1}`;
}
