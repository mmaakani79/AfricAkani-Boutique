"use client";

import { useActionState } from "react";
import { PHOTO_SEEDS, seedGradient } from "@/lib/photo-palette";
import type { Category } from "@/lib/types";
import type { ActionState } from "../../actions";

const initialState: ActionState = {};

export function CategoryForm({
  category,
  action,
  submitLabel,
}: {
  category?: Category;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="mt-6 grid max-w-2xl gap-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Nom de la catégorie
        </span>
        <input
          type="text"
          name="name"
          defaultValue={category?.name}
          required
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Slug (URL) — laisser vide pour le générer depuis le nom
        </span>
        <input
          type="text"
          name="slug"
          defaultValue={category?.slug}
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Description
        </span>
        <textarea
          name="description"
          defaultValue={category?.description}
          rows={3}
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 block text-xs font-semibold text-ink/60">
          Couleur (utilisée tant qu&rsquo;aucune photo n&rsquo;est fournie)
        </legend>
        <div className="flex flex-wrap gap-2">
          {PHOTO_SEEDS.map((seed) => (
            <label key={seed} className="cursor-pointer">
              <input
                type="radio"
                name="photoSeed"
                value={seed}
                defaultChecked={(category?.photoSeed ?? "emerald") === seed}
                className="peer sr-only"
              />
              <span
                title={seed}
                style={{ background: seedGradient(seed) }}
                className="block h-8 w-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-brand-green"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <input
          type="checkbox"
          name="featuredHome"
          defaultChecked={category?.featuredHome}
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
