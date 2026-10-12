// Idempotent order submission. The checkout page generates the order number
// once, and every attempt for that order — a retry after a network failure, a
// double click, a response that never arrived — carries the same number. When
// the server already holds an order with that number AND it is the same
// request, the original is returned instead of creating a second one.
//
// Pure (no DB), so it is unit-tested.

import { roundForZone } from "@/data/zones";
import type { QuoteSummary } from "./order-pricing";
import type { ZoneId } from "./types";

export interface StoredOrderLike {
  zoneId: ZoneId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string | null;
  mobileMoneyTransactionId: string | null;
  subtotal: number;
  shippingFee: number;
  freeShippingReached: boolean;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

export interface OrderRequestLike {
  zoneId: ZoneId;
  customer: { name: string; email: string; phone: string };
  wantsMobileMoney: boolean;
  mobileMoneyTransactionId: string | null;
  lines: { productId: string; quantity: number }[];
}

function quantitiesByProduct(lines: { productId: string; quantity: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  return totals;
}

/** True when `request` is the very request that produced `stored`. Prices are
 *  deliberately not compared: a price may have changed since the first attempt,
 *  and the retry must still find its order (it then shows what was recorded). */
export function isSameOrderRequest(stored: StoredOrderLike, request: OrderRequestLike): boolean {
  if (stored.zoneId !== request.zoneId) return false;
  if (
    stored.customerName.trim() !== request.customer.name.trim() ||
    stored.customerEmail.trim() !== request.customer.email.trim() ||
    stored.customerPhone.trim() !== request.customer.phone.trim()
  ) {
    return false;
  }
  if (stored.paymentMethod !== (request.wantsMobileMoney ? "mobile_money" : null)) return false;
  if (
    request.wantsMobileMoney &&
    (stored.mobileMoneyTransactionId ?? "").trim() !== (request.mobileMoneyTransactionId ?? "").trim()
  ) {
    return false;
  }

  const a = quantitiesByProduct(stored.items);
  const b = quantitiesByProduct(request.lines);
  if (a.size !== b.size) return false;
  for (const [productId, quantity] of a) if (b.get(productId) !== quantity) return false;
  return true;
}

/** The amounts of an order already recorded, in the shape the checkout page shows. */
export function summaryFromStoredOrder(stored: StoredOrderLike): QuoteSummary {
  return {
    subtotal: stored.subtotal,
    shippingFee: stored.shippingFee,
    total: roundForZone(stored.subtotal + stored.shippingFee, stored.zoneId),
    freeShippingReached: stored.freeShippingReached,
    items: stored.items.map((item) => ({
      productId: item.productId,
      variantId: null,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}
