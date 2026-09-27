"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingCart, Truck } from "lucide-react";
import { useZone } from "@/context/zone-context";
import { useCart } from "@/context/cart-context";
import { tiersForZone, tierRangeLabel } from "@/lib/price-tiers";
import type { Product } from "@/lib/types";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const { priceFor, format, zone } = useZone();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const price = priceFor(product, quantity);
  const unavailable = price === null;
  const outOfStock = product.stock === "rupture";
  const disabled = outOfStock || unavailable;
  const tiers = tiersForZone(product, zone.id);

  return (
    <div className="mt-6">
      {unavailable ? (
        <p className="font-brand text-xl font-bold text-ink/50">
          Non disponible dans cette zone
        </p>
      ) : (
        <p className="font-brand text-3xl font-bold text-ink">
          {format(price)}
          <span className="ml-1.5 text-sm font-semibold text-ink/40">/ unité</span>
        </p>
      )}

      {tiers.length > 1 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-brand-green/15">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-brand-green/5 text-[11px] uppercase tracking-wider text-brand-gold">
                <th className="px-3 py-2 font-bold">Quantité</th>
                <th className="px-3 py-2 font-bold">Prix unitaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-green/10 bg-white">
              {tiers.map((tier, i) => {
                const active =
                  quantity >= tier.minQty && (!tiers[i + 1] || quantity < tiers[i + 1].minQty);
                return (
                  <tr
                    key={tier.minQty}
                    className={active ? "bg-brand-green/10" : undefined}
                  >
                    <td
                      className={`px-3 py-2 ${active ? "font-bold text-brand-green-dark" : "text-ink/70"}`}
                    >
                      {tierRangeLabel(tiers, i)} {product.unit}
                      {active && " ✓"}
                    </td>
                    <td
                      className={`px-3 py-2 ${active ? "font-bold text-brand-green-dark" : "text-ink/70"}`}
                    >
                      {format(tier.price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-brand-green/20 bg-white">
          <button
            type="button"
            aria-label="Diminuer la quantité"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-2.5 text-brand-green-dark disabled:opacity-30"
            disabled={disabled}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-bold">{quantity}</span>
          <button
            type="button"
            aria-label="Augmenter la quantité"
            onClick={() => setQuantity((q) => q + 1)}
            className="p-2.5 text-brand-green-dark disabled:opacity-30"
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            addItem(product, quantity);
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:bg-ink/20"
        >
          {!disabled && !added && (
            <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          {outOfStock
            ? "Rupture de stock"
            : unavailable
              ? "Indisponible ici"
              : added
                ? "Ajouté ✓"
                : "Ajouter au panier"}
        </button>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-green-dark">
        <Truck className="h-4 w-4 shrink-0" />
        Livraison gratuite dès {format(zone.freeShippingThreshold)} d&rsquo;achat
        ({zone.label})
      </p>
    </div>
  );
}
