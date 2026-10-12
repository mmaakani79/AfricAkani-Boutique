// "Le prix a changé": compares what the customer is looking at (prices kept in
// the cart, shipping rule loaded with the page) with what the server would
// charge right now. Pure (no DB, no React), so it runs in the checkout page
// and in the tests.
//
// The cart still sends the server only ids, quantities and the zone. The server
// answers a price check with its own current figures (CartPreview); this module
// decides whether they differ from what is displayed.

import { roundForZone } from "@/data/zones";
import type { ShippingSettings } from "./shipping-types";
import type { PublicProduct, ZoneId } from "./types";

/** One cart line as the server prices it right now. */
export type PreviewLine = {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
} & (
  | { status: "available"; unitPrice: number; lineTotal: number }
  | { status: "unavailable"; reason: string }
);

/** The server's answer to a price check: current prices, shipping and total
 *  (null when a line can't be sold at all), plus fresh public product data and
 *  the zone's shipping rule so the page can adopt them if the customer agrees. */
export interface CartPreview {
  zoneId: ZoneId;
  lines: PreviewLine[];
  subtotal: number | null;
  shippingFee: number | null;
  total: number | null;
  freeShippingReached: boolean | null;
  products: PublicProduct[];
  shipping: ShippingSettings;
}

/** What the checkout page currently displays. */
export interface DisplayedPrices {
  zoneId: ZoneId;
  items: { productId: string; variantId: string | null; name: string; unitPrice: number }[];
  shippingFee: number;
  total: number;
}

export interface PriceChangeLine {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  kind: "price" | "unavailable";
  /** The price the customer saw; null when it was not sold in the zone then. */
  oldUnitPrice: number | null;
  /** The current price; null when the product can no longer be bought. */
  newUnitPrice: number | null;
  reason?: string;
}

export interface PriceChangeReport {
  zoneId: ZoneId;
  /** Lines whose price changed or that can no longer be bought. */
  lines: PriceChangeLine[];
  oldShippingFee: number;
  newShippingFee: number | null;
  oldTotal: number;
  /** null as long as a line can't be bought: there is no total to confirm. */
  newTotal: number | null;
  hasUnavailable: boolean;
  /** Fresh data for every line, adopted into the cart when the customer agrees. */
  products: PublicProduct[];
  shipping: ShippingSettings;
}

function same(a: number, b: number, zoneId: ZoneId): boolean {
  return roundForZone(a, zoneId) === roundForZone(b, zoneId);
}

const sameLine = (
  a: { productId: string; variantId: string | null },
  b: { productId: string; variantId: string | null }
) => a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

/** null when what is displayed is exactly what the server would charge. */
export function detectPriceChange(
  displayed: DisplayedPrices,
  current: CartPreview
): PriceChangeReport | null {
  const { zoneId } = displayed;
  const lines: PriceChangeLine[] = [];

  for (const line of current.lines) {
    const shown = displayed.items.find((item) => sameLine(item, line));
    const oldUnitPrice = shown && shown.unitPrice > 0 ? shown.unitPrice : null;
    const base = {
      productId: line.productId,
      variantId: line.variantId,
      name: line.name || shown?.name || "Produit",
      quantity: line.quantity,
      oldUnitPrice,
    };
    if (line.status === "unavailable") {
      lines.push({ ...base, kind: "unavailable", newUnitPrice: null, reason: line.reason });
    } else if (oldUnitPrice === null || !same(oldUnitPrice, line.unitPrice, zoneId)) {
      lines.push({ ...base, kind: "price", newUnitPrice: line.unitPrice });
    }
  }

  const hasUnavailable = lines.some((l) => l.kind === "unavailable");
  const shippingChanged =
    current.shippingFee !== null && !same(displayed.shippingFee, current.shippingFee, zoneId);
  const totalChanged = current.total !== null && !same(displayed.total, current.total, zoneId);

  if (lines.length === 0 && !shippingChanged && !totalChanged) return null;

  return {
    zoneId,
    lines,
    oldShippingFee: displayed.shippingFee,
    newShippingFee: current.shippingFee,
    oldTotal: displayed.total,
    newTotal: hasUnavailable ? null : current.total,
    hasUnavailable,
    products: current.products,
    shipping: current.shipping,
  };
}
