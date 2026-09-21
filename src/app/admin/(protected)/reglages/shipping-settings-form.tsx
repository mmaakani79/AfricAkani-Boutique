"use client";

import { useActionState } from "react";
import { ZONES } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import type { ShippingSettings } from "@/lib/shipping-types";
import {
  updateShippingSettingsAction,
  type ReglagesActionState,
} from "./actions";

const initialState: ReglagesActionState = {};

export function ShippingSettingsForm({
  settings,
}: {
  settings: Record<ZoneId, ShippingSettings>;
}) {
  const [state, formAction, pending] = useActionState(
    updateShippingSettingsAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {(Object.keys(ZONES) as ZoneId[]).map((zoneId) => {
        const zone = ZONES[zoneId];
        const zoneSettings = settings[zoneId];
        return (
          <section
            key={zoneId}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              {zone.label} ({zone.currency})
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <AmountField
                label="Seuil de livraison gratuite"
                name={`threshold_${zoneId}`}
                defaultValue={zoneSettings.freeShippingThreshold}
                zoneId={zoneId}
                required
              />
              <AmountField
                label="Frais de livraison (forfait)"
                name={`fee_${zoneId}`}
                defaultValue={zoneSettings.shippingFee}
                zoneId={zoneId}
                required
              />
              <AmountField
                label="Commande minimum (optionnel)"
                name={`min_${zoneId}`}
                defaultValue={zoneSettings.minOrderAmount ?? ""}
                zoneId={zoneId}
              />
            </div>
          </section>
        );
      })}

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
          Réglages enregistrés — appliqués immédiatement sur le site.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-green px-6 py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer les réglages"}
      </button>
    </form>
  );
}

function AmountField({
  label,
  name,
  defaultValue,
  zoneId,
  required,
}: {
  label: string;
  name: string;
  defaultValue: number | string;
  zoneId: ZoneId;
  required?: boolean;
}) {
  const isFcfa = ZONES[zoneId].currency === "FCFA";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label} ({ZONES[zoneId].currency})
      </span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={0}
        step={isFcfa ? 1 : 0.01}
        required={required}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      />
    </label>
  );
}
