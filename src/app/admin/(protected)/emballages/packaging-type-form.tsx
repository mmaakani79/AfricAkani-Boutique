"use client";

import { useActionState } from "react";
import type { PackagingTypeRecord } from "@/lib/types";
import type { ActionState } from "../../actions";

const initialState: ActionState = {};

export function PackagingTypeForm({
  packagingType,
  action,
  submitLabel,
}: {
  packagingType?: PackagingTypeRecord;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="mt-6 grid max-w-md gap-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Nom du type d&rsquo;emballage
        </span>
        <input
          type="text"
          name="name"
          defaultValue={packagingType?.name}
          required
          placeholder="Ex. Boîte en carton"
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
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
