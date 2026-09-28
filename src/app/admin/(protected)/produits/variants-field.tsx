"use client";

import { useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { Product, ProductVariant, StockStatus, VariantOption } from "@/lib/types";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `v${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function attributesKey(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

/** A sensible starting SKU so a freshly-generated variant is never blank —
 *  the admin can still edit it, but nothing is silently dropped on save for
 *  lacking one (see readProductForm, which requires a non-empty SKU). */
function defaultSkuFor(attributes: Record<string, string>): string {
  return Object.values(attributes)
    .map((v) =>
      v
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
    )
    .join("-");
}

/** Every combination of the given options' values, e.g. Taille×Couleur → S/Rouge, S/Bleu, … */
function cartesianCombinations(options: VariantOption[]): Record<string, string>[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<Record<string, string>[]>(
    (acc, option) =>
      acc.flatMap((combo) =>
        option.values.map((value) => ({ ...combo, [option.name]: value }))
      ),
    [{}]
  );
}

export function VariantsField({ product }: { product?: Product }) {
  const [options, setOptions] = useState<VariantOption[]>(
    product?.variantOptions?.map((o) => ({ ...o, values: [...o.values] })) ?? []
  );
  const [variants, setVariants] = useState<ProductVariant[]>(
    product?.variants?.map((v) => ({ ...v, attributes: { ...v.attributes } })) ?? []
  );

  function addOption() {
    setOptions((prev) => [...prev, { name: "", values: [] }]);
  }

  function updateOptionName(index: number, name: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, name } : o)));
  }

  function updateOptionValues(index: number, raw: string) {
    const values = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, values } : o)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function generateVariants() {
    const combos = cartesianCombinations(options);
    setVariants((prev) => {
      const existingByKey = new Map(prev.map((v) => [attributesKey(v.attributes), v]));
      return combos.map((attributes) => {
        const existing = existingByKey.get(attributesKey(attributes));
        return (
          existing ?? {
            id: newId(),
            attributes,
            sku: defaultSkuFor(attributes),
            stock: "en_stock" as StockStatus,
          }
        );
      });
    });
  }

  function updateVariant(id: string, patch: Partial<ProductVariant>) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="block rounded-xl border border-brand-green/15 bg-ivory p-3">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        Variantes (optionnel — ex. Taille, Couleur)
      </span>
      <p className="mb-3 text-[11px] text-ink/40">
        Définissez des options et leurs valeurs, générez les combinaisons, puis
        ajustez le SKU et le stock de chaque variante. Le client choisira une
        variante sur la fiche produit avant d&rsquo;ajouter au panier.
      </p>

      <div className="space-y-2">
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nom (ex. Taille)"
              value={option.name}
              onChange={(e) => updateOptionName(i, e.target.value)}
              className="w-32 shrink-0 rounded-lg border border-brand-green/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-green"
            />
            <input
              type="text"
              placeholder="Valeurs séparées par des virgules (ex. S, M, L, XL)"
              value={option.values.join(", ")}
              onChange={(e) => updateOptionValues(i, e.target.value)}
              className="flex-1 rounded-lg border border-brand-green/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-green"
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="shrink-0 rounded-full p-1.5 text-red-600 hover:bg-red-50"
              aria-label="Retirer cette option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addOption}
          className="flex items-center gap-1 text-xs font-bold text-brand-green-dark hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une option
        </button>
        {options.length > 0 && (
          <button
            type="button"
            onClick={generateVariants}
            className="flex items-center gap-1 text-xs font-bold text-brand-green-dark hover:underline"
          >
            <Wand2 className="h-3.5 w-3.5" /> Générer les combinaisons
          </button>
        )}
      </div>

      {variants.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-brand-green/15 pt-3">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2"
            >
              <span className="min-w-0 flex-1 text-xs font-semibold text-brand-green-dark">
                {Object.entries(variant.attributes)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </span>
              <input
                type="text"
                placeholder="SKU (obligatoire)"
                required
                value={variant.sku}
                onChange={(e) => updateVariant(variant.id, { sku: e.target.value })}
                className={`w-36 rounded-lg border bg-ivory px-2 py-1.5 text-xs outline-none focus:border-brand-green ${
                  variant.sku.trim() ? "border-brand-green/20" : "border-red-400"
                }`}
              />
              <select
                value={variant.stock}
                onChange={(e) =>
                  updateVariant(variant.id, { stock: e.target.value as StockStatus })
                }
                className="rounded-lg border border-brand-green/20 bg-ivory px-2 py-1.5 text-xs outline-none focus:border-brand-green"
              >
                <option value="en_stock">En stock</option>
                <option value="stock_limite">Stock limité</option>
                <option value="rupture">Rupture</option>
              </select>
              <button
                type="button"
                onClick={() => removeVariant(variant.id)}
                className="shrink-0 rounded-full p-1.5 text-red-600 hover:bg-red-50"
                aria-label="Retirer cette variante"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {options.map((option, i) => (
        <span key={i}>
          <input type="hidden" name="variantOptionName" value={option.name} />
          <input type="hidden" name="variantOptionValues" value={option.values.join(",")} />
        </span>
      ))}
      {variants.map((variant) => (
        <span key={variant.id}>
          <input type="hidden" name="variantId" value={variant.id} />
          <input
            type="hidden"
            name="variantAttributes"
            value={JSON.stringify(variant.attributes)}
          />
          <input type="hidden" name="variantSku" value={variant.sku} />
          <input type="hidden" name="variantStock" value={variant.stock} />
        </span>
      ))}
    </div>
  );
}
