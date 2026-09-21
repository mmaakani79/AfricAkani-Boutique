import { ensureSchema, getPool } from "./db";
import { ZONES } from "@/data/zones";
import type { ZoneId } from "./types";
import type { ShippingSettings } from "./shipping-types";

export type { ShippingSettings } from "./shipping-types";

interface ShippingSettingsRow {
  zone_id: string;
  free_shipping_threshold: string;
  shipping_fee: string;
  min_order_amount: string | null;
}

function rowToSettings(row: ShippingSettingsRow): ShippingSettings {
  return {
    zoneId: row.zone_id as ZoneId,
    freeShippingThreshold: Number(row.free_shipping_threshold),
    shippingFee: Number(row.shipping_fee),
    minOrderAmount:
      row.min_order_amount == null ? null : Number(row.min_order_amount),
  };
}

function defaultSettings(zoneId: ZoneId): ShippingSettings {
  return {
    zoneId,
    freeShippingThreshold: ZONES[zoneId].freeShippingThreshold,
    shippingFee: 0,
    minOrderAmount: null,
  };
}

export async function getAllShippingSettings(): Promise<
  Record<ZoneId, ShippingSettings>
> {
  await ensureSchema();
  const { rows } = await getPool().query<ShippingSettingsRow>(
    "SELECT * FROM shipping_settings"
  );
  const zoneIds = Object.keys(ZONES) as ZoneId[];
  const result = {} as Record<ZoneId, ShippingSettings>;
  for (const zoneId of zoneIds) {
    const row = rows.find((r) => r.zone_id === zoneId);
    result[zoneId] = row ? rowToSettings(row) : defaultSettings(zoneId);
  }
  return result;
}

export async function getShippingSettings(
  zoneId: ZoneId
): Promise<ShippingSettings> {
  const all = await getAllShippingSettings();
  return all[zoneId];
}

export async function updateShippingSettings(
  zoneId: ZoneId,
  input: {
    freeShippingThreshold: number;
    shippingFee: number;
    minOrderAmount: number | null;
  }
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO shipping_settings (zone_id, free_shipping_threshold, shipping_fee, min_order_amount, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (zone_id) DO UPDATE SET
       free_shipping_threshold = EXCLUDED.free_shipping_threshold,
       shipping_fee = EXCLUDED.shipping_fee,
       min_order_amount = EXCLUDED.min_order_amount,
       updated_at = now()`,
    [zoneId, input.freeShippingThreshold, input.shippingFee, input.minOrderAmount]
  );
}
