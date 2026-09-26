import { Star } from "lucide-react";

/** Read-only stars (partial fill by percentage) + review count — catalogue
 *  cards, product page header, admin review rows. */
export function StarRatingDisplay({
  average,
  count,
  size = "sm",
  showCount = true,
  className = "",
}: {
  average: number;
  count: number;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
}) {
  const dim = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const pct = count > 0 ? Math.max(0, Math.min(100, (average / 5) * 100)) : 0;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-flex">
        <span className="flex gap-0.5 text-ink/15">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={dim} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden text-brand-gold"
          style={{ width: `${pct}%` }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`${dim} shrink-0`} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
      </span>
      {showCount && (
        <span className="text-xs text-ink/50">
          ({count} avis)
        </span>
      )}
    </span>
  );
}
