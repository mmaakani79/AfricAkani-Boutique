import type { LucideIcon } from "lucide-react";
import { Leaf } from "lucide-react";
import { seedGradient } from "@/lib/photo-palette";

export function PhotoPlaceholder({
  seed,
  icon: Icon = Leaf,
  className = "",
}: {
  seed: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: seedGradient(seed) }}
    >
      <Icon className="h-1/3 w-1/3 text-white/25" strokeWidth={1.25} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
    </div>
  );
}
