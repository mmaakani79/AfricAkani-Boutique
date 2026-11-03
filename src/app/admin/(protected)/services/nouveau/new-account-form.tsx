"use client";

import { useState } from "react";
import Link from "next/link";
import { createServiceAccountAction, type NewServiceAccountState } from "../actions";
import { PrivateLinkBox } from "@/components/admin/service-controls";
import { useKeptFormAction } from "@/components/use-kept-form-action";

export interface ContractOption {
  id: string;
  label: string;
  merchantName: string;
  clientName: string;
  email: string;
  phone: string;
}

const INPUT =
  "w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green";
const LABEL = "mb-1 block text-[11px] font-semibold text-ink/60";

export function NewAccountForm({ contracts }: { contracts: ContractOption[] }) {
  const { state, formAction, pending, onReset } = useKeptFormAction<NewServiceAccountState>(createServiceAccountAction, {});
  const [contractId, setContractId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [count, setCount] = useState(3);
  const contract = contracts.find((c) => c.id === contractId);

  if (state.ok && state.link && state.accountId) {
    return (
      <div className="space-y-4 rounded-2xl bg-white p-5" data-testid="account-created">
        <p className="text-sm font-bold text-brand-green-dark">✓ Dossier créé ({state.accountId}).</p>
        <PrivateLinkBox link={state.link} phone={clientPhone || contract?.phone} merchantName={merchantName} />
        <Link
          href={`/admin/services/${state.accountId}`}
          className="inline-block rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark"
        >
          Ouvrir le dossier →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} onReset={onReset} className="space-y-5 rounded-2xl bg-white p-5" data-testid="new-account-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={LABEL}>Contrat signé lié au dossier</span>
          <select
            name="contractId"
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              const c = contracts.find((x) => x.id === e.target.value);
              // The contract fills the empty fields; what is already typed is never overwritten.
              if (c && !merchantName) setMerchantName(c.merchantName);
              if (c && !clientName) setClientName(c.clientName);
              if (c && !clientEmail) setClientEmail(c.email);
              if (c && !clientPhone) setClientPhone(c.phone);
            }}
            className={INPUT}
          >
            <option value="">— Aucun contrat lié —</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={LABEL}>Nom du marchand</span>
          <input
            name="merchantName"
            type="text"
            required
            maxLength={120}
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Client — nom (pour le reçu)</span>
          <input name="clientName" type="text" maxLength={120} value={clientName} onChange={(e) => setClientName(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Client — e-mail (reçus)</span>
          <input name="clientEmail" type="email" maxLength={160} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={INPUT} />
        </label>
        <label className="block sm:col-span-2">
          <span className={LABEL}>Client — téléphone / WhatsApp (envoi du lien et du reçu)</span>
          <input name="clientPhone" type="tel" maxLength={30} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Prix total (FCFA)</span>
          <input name="total" type="text" inputMode="numeric" required defaultValue="100000" className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Acompte (FCFA) — déduit du total</span>
          <input name="deposit" type="text" inputMode="numeric" required defaultValue="5000" className={INPUT} />
        </label>
      </div>

      <fieldset>
        <legend className={LABEL}>Nombre de tranches (après l&rsquo;acompte)</legend>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4].map((n) => (
            <label
              key={n}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${
                count === n ? "border-brand-green bg-brand-green text-ivory" : "border-brand-green/20 bg-white text-brand-green-dark"
              }`}
            >
              <input
                type="radio"
                name="installmentCount"
                value={n}
                checked={count === n}
                onChange={() => setCount(n)}
                className="sr-only"
              />
              {n} tranches
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="block">
              <span className={LABEL}>Tranche {i + 1} — étiquette libre</span>
              <input name="label" type="text" maxLength={80} placeholder={i === 0 ? "ex. avant mise en ligne" : ""} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Date limite</span>
              <input name="date" type="date" required className={INPUT} />
            </label>
          </div>
        ))}
        <p className="text-[11px] text-ink/50">
          Les montants des tranches se calculent seuls : (prix total − acompte − réductions) ÷ nombre de tranches.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={LABEL}>Date de mise en ligne (si connue)</span>
          <input name="goLiveDate" type="date" className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Mensualité de suivi (FCFA)</span>
          <input name="followupAmount" type="text" inputMode="numeric" defaultValue="3000" className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Payable</span>
          <select name="followupPeriod" defaultValue="month" className={INPUT}>
            <option value="month">au mois</option>
            <option value="quarter">au trimestre</option>
          </select>
        </label>
        <label className="block sm:col-span-3">
          <span className={LABEL}>Note interne (facultatif)</span>
          <input name="note" type="text" maxLength={500} className={INPUT} />
        </label>
      </div>

      {state.error && (
        <p role="alert" data-testid="new-account-error" className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full bg-brand-green px-6 py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le dossier et le lien privé"}
      </button>
    </form>
  );
}
