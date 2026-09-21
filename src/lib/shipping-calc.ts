import type { ShippingSettings } from "./shipping-types";

/** Below the zone's free-shipping threshold, the flat fee applies; at or above it, shipping is free. */
export function computeShippingFee(
  subtotal: number,
  rule: Pick<ShippingSettings, "freeShippingThreshold" | "shippingFee">
): number {
  return subtotal >= rule.freeShippingThreshold ? 0 : rule.shippingFee;
}

export function isBelowMinOrder(
  subtotal: number,
  rule: Pick<ShippingSettings, "minOrderAmount">
): boolean {
  return rule.minOrderAmount != null && subtotal < rule.minOrderAmount;
}
