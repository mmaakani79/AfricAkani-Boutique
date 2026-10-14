// Which products a visitor may see and buy in a zone. A product is sold in a
// zone when it has a price there (an empty price = « non vendu dans cette
// zone »): the same rule the server applies when it prices an order
// (price-tiers.ts → priceForQuantity), so what is shown is what can be ordered.
//
// Pure (no DB, no React): used by the storefront components, the server pages
// and the sitemap, and unit-tested.

import type { ZoneId } from "./types";

export const ALL_ZONE_IDS: readonly ZoneId[] = ["bj", "ca", "us"];

interface HasPrices {
  prices: Record<ZoneId, number | null>;
}

/** True when the product has a price in this zone. */
export function isSoldInZone(product: HasPrices, zoneId: ZoneId): boolean {
  const price = product.prices[zoneId];
  return price !== null && price !== undefined;
}

/** The zones this product is sold in (empty = sold nowhere: hidden from the public). */
export function zonesSoldIn(product: HasPrices): ZoneId[] {
  return ALL_ZONE_IDS.filter((zoneId) => isSoldInZone(product, zoneId));
}

export function isSoldInAnyZone(product: HasPrices): boolean {
  return zonesSoldIn(product).length > 0;
}

/** The products a visitor in `zoneId` can see. */
export function visibleInZone<T extends HasPrices>(products: readonly T[], zoneId: ZoneId): T[] {
  return products.filter((product) => isSoldInZone(product, zoneId));
}

/** The products the public may ever see (sold in at least one zone). */
export function publiclyListed<T extends HasPrices>(products: readonly T[]): T[] {
  return products.filter(isSoldInAnyZone);
}

/** categoryId → the zones where at least one product of that category is sold. */
export function categoryZones(
  products: readonly (HasPrices & { categoryId: string })[]
): Record<string, ZoneId[]> {
  const byCategory: Record<string, Set<ZoneId>> = {};
  for (const product of products) {
    const set = (byCategory[product.categoryId] ??= new Set<ZoneId>());
    for (const zoneId of zonesSoldIn(product)) set.add(zoneId);
  }
  return Object.fromEntries(
    Object.entries(byCategory).map(([categoryId, zones]) => [
      categoryId,
      ALL_ZONE_IDS.filter((z) => zones.has(z)),
    ])
  );
}

/** Splits cart lines into those sold in the zone (kept) and the others (removed).
 *  The cart applies it every time the zone changes, so it never holds a product
 *  that cannot be ordered where the customer is. */
export function splitCartByZone<T extends { product: HasPrices }>(
  lines: readonly T[],
  zoneId: ZoneId
): { kept: T[]; removed: T[] } {
  const kept: T[] = [];
  const removed: T[] = [];
  for (const line of lines) (isSoldInZone(line.product, zoneId) ? kept : removed).push(line);
  return { kept, removed };
}
