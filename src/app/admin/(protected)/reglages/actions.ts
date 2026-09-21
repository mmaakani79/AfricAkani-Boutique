"use server";

import { revalidatePath } from "next/cache";
import { updateShippingSettings } from "@/lib/shipping-settings-db";
import { ZONES, roundForZone } from "@/data/zones";
import type { ZoneId } from "@/lib/types";

export interface ReglagesActionState {
  error?: string;
  success?: boolean;
}

function readRequiredAmount(
  formData: FormData,
  field: string
): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function updateShippingSettingsAction(
  _prevState: ReglagesActionState,
  formData: FormData
): Promise<ReglagesActionState> {
  const zoneIds = Object.keys(ZONES) as ZoneId[];
  const parsed: {
    zoneId: ZoneId;
    freeShippingThreshold: number;
    shippingFee: number;
    minOrderAmount: number | null;
  }[] = [];

  for (const zoneId of zoneIds) {
    const threshold = readRequiredAmount(formData, `threshold_${zoneId}`);
    const fee = readRequiredAmount(formData, `fee_${zoneId}`);
    if (threshold === null || fee === null) {
      return {
        error: `Seuil ou frais de livraison invalide pour la zone ${ZONES[zoneId].shortLabel}.`,
      };
    }

    const minRaw = String(formData.get(`min_${zoneId}`) ?? "").trim();
    let minOrderAmount: number | null = null;
    if (minRaw !== "") {
      const min = Number(minRaw);
      if (!Number.isFinite(min) || min < 0) {
        return {
          error: `Montant minimum de commande invalide pour la zone ${ZONES[zoneId].shortLabel}.`,
        };
      }
      minOrderAmount = roundForZone(min, zoneId);
    }

    parsed.push({
      zoneId,
      freeShippingThreshold: roundForZone(threshold, zoneId),
      shippingFee: roundForZone(fee, zoneId),
      minOrderAmount,
    });
  }

  for (const settings of parsed) {
    await updateShippingSettings(settings.zoneId, settings);
  }

  revalidatePath("/admin/reglages");
  return { success: true };
}
