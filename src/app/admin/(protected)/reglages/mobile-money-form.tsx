"use client";

import { useActionState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import type { MobileMoneyOperator } from "@/lib/mobile-money-types";
import { operatorLogoSrc } from "@/lib/mobile-money-logos";
import {
  createOperatorAction,
  deleteOperatorAction,
  updateBeneficiaryNameAction,
  updateOperatorAction,
  type MobileMoneyActionState,
} from "./mobile-money-actions";

const initialState: MobileMoneyActionState = {};

export function MobileMoneyForm({
  beneficiaryName,
  operators,
}: {
  beneficiaryName: string;
  operators: MobileMoneyOperator[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
          Mobile Money — bénéficiaire
        </h2>
        <BeneficiaryNameForm defaultName={beneficiaryName} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
          Mobile Money — opérateurs
        </h2>
        <p className="mt-1 text-xs text-ink/50">
          Codes de transfert marchand affichés au client au moment du
          paiement. Liste entièrement configurable — ajoutez, modifiez ou
          retirez un opérateur à tout moment.
        </p>
        <div className="mt-4 space-y-3">
          {operators.map((op) => (
            <OperatorRow key={op.id} operator={op} />
          ))}
          {operators.length === 0 && (
            <p className="text-sm text-ink/50">Aucun opérateur configuré.</p>
          )}
        </div>
        <div className="mt-5 border-t border-brand-green/10 pt-4">
          <AddOperatorForm />
        </div>
      </section>
    </div>
  );
}

function BeneficiaryNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState(
    updateBeneficiaryNameAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink/60">
          Nom du bénéficiaire (affiché au client)
        </span>
        <input
          type="text"
          name="beneficiaryName"
          defaultValue={defaultName}
          className="w-64 rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      {state.success && (
        <span className="text-xs font-semibold text-brand-green-dark">
          Enregistré.
        </span>
      )}
    </form>
  );
}

function OperatorRow({ operator }: { operator: MobileMoneyOperator }) {
  const action = updateOperatorAction.bind(null, operator.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [deleting, startDelete] = useTransition();
  const logoSrc = operatorLogoSrc(operator.name);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-brand-green/10 bg-ivory p-3"
    >
      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- official operator logo, must render exactly as provided
        <img
          src={logoSrc}
          alt=""
          className="h-9 w-9 shrink-0 self-center rounded bg-white object-contain p-0.5"
        />
      )}
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Nom
        </span>
        <input
          type="text"
          name="name"
          defaultValue={operator.name}
          required
          className="w-32 rounded-lg border border-brand-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Code de transfert marchand (pas un numéro de téléphone)
        </span>
        <input
          type="text"
          name="merchantNumber"
          defaultValue={operator.merchantNumber}
          placeholder="Ex. *880*1*12345#"
          className="w-40 rounded-lg border border-brand-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Nom affiché chez l&rsquo;opérateur
        </span>
        <input
          type="text"
          name="displayName"
          defaultValue={operator.displayName}
          placeholder="Ex. AKANI SARL"
          className="w-44 rounded-lg border border-brand-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <label className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold text-ink/70">
        <input
          type="checkbox"
          name="active"
          defaultChecked={operator.active}
          className="h-3.5 w-3.5"
        />
        Actif
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          if (window.confirm(`Supprimer l'opérateur « ${operator.name} » ?`)) {
            startDelete(() => deleteOperatorAction(operator.id));
          }
        }}
        className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" /> Supprimer
      </button>
      {state.error && (
        <p className="w-full text-xs font-semibold text-red-600">{state.error}</p>
      )}
    </form>
  );
}

function AddOperatorForm() {
  const [state, formAction, pending] = useActionState(
    createOperatorAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Nouvel opérateur — nom
        </span>
        <input
          type="text"
          name="name"
          required
          placeholder="Ex. Wave"
          className="w-32 rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Code de transfert marchand
        </span>
        <input
          type="text"
          name="merchantNumber"
          placeholder="Ex. *880*1*12345#"
          className="w-40 rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink/60">
          Nom affiché chez l&rsquo;opérateur
        </span>
        <input
          type="text"
          name="displayName"
          placeholder="Ex. AKANI SARL"
          className="w-44 rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-full bg-brand-gold px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-brand-gold-light disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" /> {pending ? "…" : "Ajouter"}
      </button>
      {state.error && (
        <p className="w-full text-xs font-semibold text-red-600">{state.error}</p>
      )}
    </form>
  );
}
