import {
  Droplet,
  Hexagon,
  Flame,
  Smartphone,
  Dumbbell,
  Shirt,
  Bird,
  UtensilsCrossed,
  Leaf,
  type LucideIcon,
} from "lucide-react";

/**
 * Placeholder hero background until real product photography is supplied.
 * Scatters icons from across the catalogue (natural products, electronics,
 * sport, textile, household, poultry equipment) over a brand gradient, to
 * signal "a bit of everything" rather than only spices/natural goods.
 */
const MOTIFS: { Icon: LucideIcon; className: string }[] = [
  { Icon: Droplet, className: "left-[4%] top-[12%] h-16 w-16 rotate-[-8deg] opacity-[0.16]" },
  { Icon: Hexagon, className: "left-[18%] top-[62%] h-20 w-20 rotate-[6deg] opacity-[0.14]" },
  { Icon: Flame, className: "left-[34%] top-[8%] h-12 w-12 rotate-[10deg] opacity-[0.14]" },
  { Icon: Smartphone, className: "left-[52%] top-[70%] h-14 w-14 rotate-[-6deg] opacity-[0.16]" },
  { Icon: Dumbbell, className: "left-[66%] top-[18%] h-16 w-16 rotate-[12deg] opacity-[0.15]" },
  { Icon: Shirt, className: "left-[80%] top-[58%] h-20 w-20 rotate-[-10deg] opacity-[0.16]" },
  { Icon: Bird, className: "left-[90%] top-[14%] h-12 w-12 rotate-[4deg] opacity-[0.13]" },
  { Icon: UtensilsCrossed, className: "left-[8%] top-[82%] h-14 w-14 rotate-[-4deg] opacity-[0.14]" },
  { Icon: Leaf, className: "left-[44%] top-[38%] h-24 w-24 rotate-[-14deg] opacity-[0.1]" },
];

export function HeroCollage() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(120deg, #0e5a44 0%, #123d2c 45%, #6e4a2e 100%)",
      }}
    >
      {MOTIFS.map(({ Icon, className }, i) => (
        <Icon
          key={i}
          className={`absolute text-white ${className}`}
          strokeWidth={1.1}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  );
}
