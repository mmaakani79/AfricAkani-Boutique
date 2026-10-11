// Server-side pricing of an order. Pure (products and shipping rules are
// passed in), so it is unit-tested without a database.
//
// The browser's prices are never read. Each line is priced from the product
// as it is in the database right now: the same per-zone price and quantity
// tiers the storefront displays (price-tiers.ts), the zone's shipping rule
// (shipping-calc.ts), and the same rounding (roundForZone).

import { ZONES, formatPrice, roundForZone } from "@/data/zones";
import { MAX_QUANTITY_PER_LINE } from "./order-draft";
import { priceForQuantity } from "./price-tiers";
import { computeShippingFee, isBelowMinOrder } from "./shipping-calc";
import type { ShippingSettings } from "./shipping-types";
import type { Product, ZoneId } from "./types";

export interface RequestedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  variantId: string | null;
  /** Product name (+ " (Taille: M, …)" for a variant), as stored on the order. */
  name: string;
  /** Internal supplier reference — server-side only, never sent to the browser. */
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderQuote {
  zoneId: ZoneId;
  currency: "FCFA" | "CAD" | "USD";
  lines: PricedLine[];
  subtotal: number;
  shippingFee: number;
  freeShippingReached: boolean;
  total: number;
}

export type QuoteResult = { ok: true; quote: OrderQuote } | { ok: false; error: string };

/** The same product + variant on two lines is one line: quantity tiers apply
 *  to the combined quantity, so splitting an order can't dodge (or fake) a tier. */
export function mergeLines(lines: RequestedLine[]): RequestedLine[] {
  const merged = new Map<string, RequestedLine>();
  for (const line of lines) {
    const key = `${line.productId}::${line.variantId ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += line.quantity;
    else merged.set(key, { ...line });
  }
  return [...merged.values()];
}

export function priceOrder(params: {
  zoneId: ZoneId;
  lines: RequestedLine[];
  products: ReadonlyMap<string, Product>;
  shipping: ShippingSettings;
}): QuoteResult {
  const { zoneId, products, shipping } = params;
  const zone = ZONES[zoneId];
  const lines: PricedLine[] = [];

  for (const requested of mergeLines(params.lines)) {
    const product = products.get(requested.productId);
    if (!product) {
      return {
        ok: false,
        error: "Un produit de votre panier n'existe plus. Retirez-le puis réessayez.",
      };
    }

    const hasVariants = (product.variants?.length ?? 0) > 0;
    let variantLabel: string | null = null;
    let sku = product.sku ?? null;
    let stock = product.stock;

    if (hasVariants) {
      if (!requested.variantId) {
        return { ok: false, error: `Choisissez une variante pour « ${product.name} ».` };
      }
      const variant = product.variants!.find((v) => v.id === requested.variantId);
      if (!variant) {
        return {
          ok: false,
          error: `La variante choisie pour « ${product.name} » n'existe plus. Retirez-la puis réessayez.`,
        };
      }
      variantLabel = Object.entries(variant.attributes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      sku = variant.sku;
      stock = variant.stock;
    } else if (requested.variantId) {
      return {
        ok: false,
        error: `La variante choisie pour « ${product.name} » n'existe pas. Retirez-la puis réessayez.`,
      };
    }

    if (stock === "rupture") {
      return {
        ok: false,
        error: `« ${product.name} » est en rupture de stock. Retirez-le de votre panier.`,
      };
    }

    // The per-line cap is also enforced on the merged quantity, so repeating a
    // product on several lines can't get around it.
    if (requested.quantity > MAX_QUANTITY_PER_LINE) {
      return {
        ok: false,
        error: `Quantité invalide pour « ${product.name} » : choisissez un nombre entier entre 1 et ${MAX_QUANTITY_PER_LINE}.`,
      };
    }

    const price = priceForQuantity(product, zoneId, requested.quantity);
    if (price === null) {
      return {
        ok: false,
        error: `« ${product.name} » n'est pas vendu dans cette zone. Retirez-le de votre panier.`,
      };
    }

    const unitPrice = roundForZone(price, zoneId);
    lines.push({
      productId: product.id,
      variantId: requested.variantId,
      name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      sku,
      quantity: requested.quantity,
      unitPrice,
      lineTotal: roundForZone(unitPrice * requested.quantity, zoneId),
    });
  }

  const subtotal = roundForZone(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
    zoneId
  );

  if (isBelowMinOrder(subtotal, shipping)) {
    return {
      ok: false,
      error: `Montant minimum de commande pour cette zone : ${formatPrice(
        shipping.minOrderAmount!,
        zoneId
      )}.`,
    };
  }

  const shippingFee = roundForZone(computeShippingFee(subtotal, shipping), zoneId);

  return {
    ok: true,
    quote: {
      zoneId,
      currency: zone.currency,
      lines,
      subtotal,
      shippingFee,
      freeShippingReached: subtotal >= shipping.freeShippingThreshold,
      total: roundForZone(subtotal + shippingFee, zoneId),
    },
  };
}

// ---- What is handed to the payment providers -------------------------------

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: { name: string };
    unit_amount: number;
  };
  quantity: number;
}

/** Stripe Checkout lines built only from the server's quote: one per product
 *  line, plus the shipping fee. Their sum is exactly `quote.total`. */
export function stripeLineItems(quote: OrderQuote): StripeLineItem[] {
  const currency = quote.currency.toLowerCase();
  const items: StripeLineItem[] = quote.lines.map((line) => ({
    price_data: {
      currency,
      product_data: { name: line.name },
      unit_amount: toMinorUnits(line.unitPrice),
    },
    quantity: line.quantity,
  }));
  if (quote.shippingFee > 0) {
    items.push({
      price_data: {
        currency,
        product_data: { name: "Livraison" },
        unit_amount: toMinorUnits(quote.shippingFee),
      },
      quantity: 1,
    });
  }
  return items;
}

/** What Stripe would charge for these lines, in minor units (cents). */
export function stripeChargeMinor(items: StripeLineItem[]): number {
  return items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
}

/** Defense in depth: the amount sent to Stripe must be exactly the order total
 *  that gets stored. Checked before anything is written or created. */
export function stripeAmountMatchesQuote(quote: OrderQuote): boolean {
  return stripeChargeMinor(stripeLineItems(quote)) === toMinorUnits(quote.total);
}

// ---- What goes back to the browser ----------------------------------------

export interface QuoteSummaryLine {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** The server's amounts, as shown to the customer. No SKU: internal references
 *  never leave the server. */
export interface QuoteSummary {
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShippingReached: boolean;
  items: QuoteSummaryLine[];
}

export function summarizeQuote(quote: OrderQuote): QuoteSummary {
  return {
    subtotal: quote.subtotal,
    shippingFee: quote.shippingFee,
    total: quote.total,
    freeShippingReached: quote.freeShippingReached,
    items: quote.lines.map(({ productId, variantId, name, quantity, unitPrice, lineTotal }) => ({
      productId,
      variantId,
      name,
      quantity,
      unitPrice,
      lineTotal,
    })),
  };
}
