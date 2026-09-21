import type { ZoneId } from "./types";

export interface ShippingSettings {
  zoneId: ZoneId;
  freeShippingThreshold: number;
  shippingFee: number;
  minOrderAmount: number | null;
}
