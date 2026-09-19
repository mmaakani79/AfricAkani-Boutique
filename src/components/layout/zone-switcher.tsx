"use client";

import { useZone } from "@/context/zone-context";
import { ZONES } from "@/data/zones";
import type { ZoneId } from "@/lib/types";

const ORDER: ZoneId[] = ["bj", "ca", "us"];

export function ZoneSwitcher() {
  const { zoneId, setZoneId } = useZone();

  return (
    <div
      role="group"
      aria-label="Zone de livraison et devise"
      className="flex items-center rounded-full border border-brand-green/20 bg-white p-0.5 text-xs font-semibold"
    >
      {ORDER.map((id) => {
        const zone = ZONES[id];
        const active = id === zoneId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setZoneId(id)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-brand-green text-ivory"
                : "text-brand-green/70 hover:text-brand-green"
            }`}
          >
            {zone.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
