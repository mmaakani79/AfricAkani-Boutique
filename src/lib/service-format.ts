import { formatPrice } from "@/data/zones";

/** "5 000 FCFA" (whole francs, French thousands separator). */
export function fcfa(amount: number): string {
  return formatPrice(amount, "bj");
}

/** "30 novembre 2026" from "2026-11-30" (the date is a calendar day, not an instant). */
export function dateFr(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "30/11/2026 14:05" in Benin time, from an ISO instant. */
export function dateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Porto-Novo",
  });
}
