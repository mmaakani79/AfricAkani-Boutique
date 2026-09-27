"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ZONES } from "@/data/zones";
import type { PriceTier, ZoneId } from "@/lib/types";

const ZONE_IDS: ZoneId[] = ["bj", "ca", "us"];

export function PriceTiersField({
  defaultValue,
}: {
  defaultValue?: Partial<Record<ZoneId, PriceTier[]>>;
}) {
  const [tiersByZone, setTiersByZone] = useState<Record<ZoneId, PriceTier[]>>({
    bj: [...(defaultValue?.bj ?? [])].sort((a, b) => a.minQty - b.minQty),
    ca: [...(defaultValue?.ca ?? [])].sort((a, b) => a.minQty - b.minQty),
    us: [...(defaultValue?.us ?? [])].sort((a, b) => a.minQty - b.minQty),
  });

  function addTier(zoneId: ZoneId) {
    setTiersByZone((prev) => {
      const zoneTiers = prev[zoneId];
      const lastMinQty = zoneTiers.at(-1)?.minQty ?? 1;
      return {
        ...prev,
        [zoneId]: [...zoneTiers, { minQty: lastMinQty + 9, price: 0 }],
      };
    });
  }

  function removeTier(zoneId: ZoneId, index: number) {
    setTiersByZone((prev) => ({
      ...prev,
      [zoneId]: prev[zoneId].filter((_, i) => i !== index),
    }));
  }

  function updateTier(zoneId: ZoneId, index: number, patch: Partial<PriceTier>) {
    setTiersByZone((prev) => ({
      ...prev,
      [zoneId]: prev[zoneId].map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        Paliers de prix par quantité (optionnel)
      </span>
      <p className="mb-2 text-[11px] text-ink/40">
        Le prix de base ci-dessus s&rsquo;applique à partir de 1 unité. Ajoutez
        un palier pour proposer un prix dégressif à partir d&rsquo;une quantité
        donnée (ex. 10 unités, 100 unités).
      </p>

      {ZONE_IDS.map((zoneId) => (
        <div key={zoneId} className="mb-3 rounded-xl border border-brand-green/15 bg-ivory p-3">
          <p className="mb-2 text-xs font-bold text-brand-green-dark">
            {ZONES[zoneId].shortLabel}
          </p>
          <div className="space-y-2">
            {tiersByZone[zoneId].map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-ink/50">À partir de</span>
                <input
                  type="number"
                  min={2}
                  step={1}
                  value={tier.minQty}
                  onChange={(e) =>
                    updateTier(zoneId, i, { minQty: Number(e.target.value) })
                  }
                  className="w-20 rounded-lg border border-brand-green/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-green"
                />
                <span className="text-xs text-ink/50">unités →</span>
                <input
                  type="number"
                  min={0}
                  step={ZONES[zoneId].currency === "FCFA" ? 1 : 0.01}
                  value={tier.price}
                  onChange={(e) =>
                    updateTier(zoneId, i, { price: Number(e.target.value) })
                  }
                  className="w-24 rounded-lg border border-brand-green/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-green"
                />
                <span className="text-xs text-ink/50">{ZONES[zoneId].currency}</span>
                <button
                  type="button"
                  onClick={() => removeTier(zoneId, i)}
                  className="ml-auto rounded-full p-1.5 text-red-600 hover:bg-red-50"
                  aria-label="Retirer ce palier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addTier(zoneId)}
            className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-green-dark hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un palier
          </button>
        </div>
      ))}

      {ZONE_IDS.flatMap((zoneId) =>
        tiersByZone[zoneId].map((tier, i) => (
          <span key={`${zoneId}-${i}`}>
            <input type="hidden" name="tierZone" value={zoneId} />
            <input type="hidden" name="tierMinQty" value={tier.minQty} />
            <input type="hidden" name="tierPrice" value={tier.price} />
          </span>
        ))
      )}
    </div>
  );
}
