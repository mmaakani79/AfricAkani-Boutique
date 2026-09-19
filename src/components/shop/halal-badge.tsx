import type { HalalStatus } from "@/lib/types";

const STYLES: Record<HalalStatus, string> = {
  oui: "bg-brand-green text-ivory",
  a_verifier: "bg-brand-gold text-brand-green-dark",
  "n/a": "bg-white/80 text-ink/50",
};

const LABELS: Record<HalalStatus, string> = {
  oui: "VÉRIFIÉ",
  a_verifier: "À VÉR.",
  "n/a": "N/A",
};

export function HalalBadge({ status }: { status: HalalStatus }) {
  if (status === "n/a") return null;
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
