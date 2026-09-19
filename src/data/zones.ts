import type { Zone, ZoneId } from "@/lib/types";

export const ZONES: Record<ZoneId, Zone> = {
  bj: {
    id: "bj",
    label: "Bénin & Afrique de l'Ouest",
    shortLabel: "Afrique (FCFA)",
    currency: "FCFA",
    freeShippingThreshold: 20000,
    regionDescription:
      "Cotonou, Porto-Novo, Abomey-Calavi et la zone CFA.",
  },
  ca: {
    id: "ca",
    label: "Canada",
    shortLabel: "CA Canada",
    currency: "CAD",
    freeShippingThreshold: 50,
    regionDescription: "Diaspora ouest-africaine au Canada.",
  },
  us: {
    id: "us",
    label: "États-Unis",
    shortLabel: "US États-Unis",
    currency: "USD",
    freeShippingThreshold: 55,
    regionDescription: "Diaspora ouest-africaine aux États-Unis.",
  },
};

export const DEFAULT_ZONE: ZoneId = "bj";

export function formatPrice(amount: number, zoneId: ZoneId): string {
  const zone = ZONES[zoneId];
  if (zone.currency === "FCFA") {
    return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
  }
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${zone.currency}`;
}
