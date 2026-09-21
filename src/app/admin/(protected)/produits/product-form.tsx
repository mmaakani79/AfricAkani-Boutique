"use client";

import { useActionState } from "react";
import { CATEGORIES } from "@/data/categories";
import { PACKAGING_LABELS } from "@/lib/packaging";
import type { Product } from "@/lib/types";
import type { ActionState } from "../../actions";

const initialState: ActionState = {};

export function ProductForm({
  product,
  action,
  submitLabel,
}: {
  product?: Product;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="mt-6 grid max-w-2xl gap-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      <Field label="Nom du produit" name="name" defaultValue={product?.name} required />
      <Field
        label="Slug (URL) — laisser vide pour le générer depuis le nom"
        name="slug"
        defaultValue={product?.slug}
      />
      <Field
        label="SKU (code interne, visible uniquement dans l'admin) — laisser vide pour le générer"
        name="sku"
        defaultValue={product?.sku}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Catégorie
        </span>
        <select
          name="categoryId"
          defaultValue={product?.categoryId ?? CATEGORIES[0].id}
          required
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Statut halal
          </span>
          <select
            name="halal"
            defaultValue={product?.halal ?? "oui"}
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          >
            <option value="oui">Halal vérifié</option>
            <option value="a_verifier">À vérifier</option>
            <option value="n/a">Non applicable</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Disponibilité
          </span>
          <select
            name="stock"
            defaultValue={product?.stock ?? "en_stock"}
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          >
            <option value="en_stock">En stock</option>
            <option value="stock_limite">Stock limité</option>
            <option value="rupture">Rupture de stock</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Unité de vente" name="unit" defaultValue={product?.unit} required />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Emballage
          </span>
          <select
            name="packaging"
            defaultValue={product?.packaging ?? "carton_boite"}
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          >
            {Object.entries(PACKAGING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Description
        </span>
        <textarea
          name="description"
          defaultValue={product?.description}
          rows={3}
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <Field
          label="Prix Bénin (FCFA) — vide = non vendu dans cette zone"
          name="priceBj"
          type="number"
          step="1"
          defaultValue={product?.prices.bj ?? undefined}
        />
        <Field
          label="Prix Canada (CAD) — vide = non vendu dans cette zone"
          name="priceCa"
          type="number"
          step="0.01"
          defaultValue={product?.prices.ca ?? undefined}
        />
        <Field
          label="Prix États-Unis (USD) — vide = non vendu dans cette zone"
          name="priceUs"
          type="number"
          step="0.01"
          defaultValue={product?.prices.us ?? undefined}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={product?.featured}
          className="h-4 w-4 rounded border-brand-green/30"
        />
        Mettre en avant sur la page d&rsquo;accueil
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label}
      </span>
      <input
        type={type}
        name={name}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      />
    </label>
  );
}
