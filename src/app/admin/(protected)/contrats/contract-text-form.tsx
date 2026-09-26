"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { updateContractTextAction, type ContractTextState } from "./actions";

const initialState: ContractTextState = {};

export function ContractTextForm({ contractText }: { contractText: string }) {
  const [state, formAction, pending] = useActionState(updateContractTextAction, initialState);
  const [text, setText] = useState(contractText);

  return (
    <form action={formAction} className="space-y-3 rounded-2xl bg-white p-5">
      <textarea
        name="contractText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-brand-green"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" /> {pending ? "Enregistrement…" : "Enregistrer le texte"}
        </button>
        {state.saved && (
          <span className="text-xs font-semibold text-brand-green-dark">✓ Enregistré</span>
        )}
        {state.error && (
          <span className="text-xs font-semibold text-red-600">{state.error}</span>
        )}
      </div>
      <p className="text-[11px] text-ink/40">
        Ce texte est déjà un modèle générique à titre indicatif — faites-le
        relire par un professionnel du droit avant de vous y fier
        juridiquement. Les contrats déjà signés gardent le texte tel qu&rsquo;il
        était au moment de la signature.
      </p>
    </form>
  );
}
