// Official operator logos, provided by AfricAkani and used as-is (never
// redrawn/recolored). Matched by the operator's configured name — an
// operator without a matching entry here falls back to its plain colored
// pill with the name spelled out large, which is the intended fallback.
const KNOWN_LOGOS: Record<string, string> = {
  mtn: "/logos/mtn.webp",
  moov: "/logos/moov.webp",
  celtiis: "/logos/celtiis.webp",
};

export function operatorLogoSrc(operatorName: string): string | null {
  return KNOWN_LOGOS[operatorName.trim().toLowerCase()] ?? null;
}
