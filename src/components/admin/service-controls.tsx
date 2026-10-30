"use client";

import { useState, useTransition } from "react";
import { useKeptFormAction } from "@/components/use-kept-form-action";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import type {
  RegenerateLinkState,
  ServiceActionState,
} from "@/app/admin/(protected)/services/actions";
import { PAYMENT_METHOD_LABELS, ADMIN_PAYMENT_METHODS } from "@/lib/service-validation";
import { ADJUSTMENT_KIND_LABELS } from "@/lib/service-account-math";

const INPUT =
  "w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green";
const LABEL = "mb-1 block text-[11px] font-semibold text-ink/60";
const PRIMARY =
  "flex min-h-10 items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60";

type Action = (previous: ServiceActionState, formData: FormData) => Promise<ServiceActionState>;

function Result({ state }: { state: ServiceActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-xs font-semibold text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-xs font-semibold text-brand-green-dark">
        ✓ {state.message}
      </p>
    );
  }
  return null;
}

/** The client's private link, shown once: copy it, or open WhatsApp with it ready to send. */
export function PrivateLinkBox({ link, phone, merchantName }: { link: string; phone?: string; merchantName?: string }) {
  const [copied, setCopied] = useState(false);
  const digits = (phone ?? "").replace(/\D/g, "");
  const message = `Bonjour${merchantName ? ` ${merchantName}` : ""}, voici le lien privé pour suivre et régler votre dossier de paiement : ${link}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.getElementById("private-link-input") as HTMLInputElement | null;
      el?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }
  return (
    <div className="space-y-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4" data-testid="private-link-box">
      <p className="text-sm font-bold text-brand-green-dark">Lien privé du client</p>
      <p className="text-xs text-ink/70">
        Copiez-le maintenant : il ne sera plus affiché (seule son empreinte est gardée). Si vous le perdez, créez-en un
        nouveau depuis le dossier.
      </p>
      <input
        id="private-link-input"
        readOnly
        value={link}
        data-testid="private-link"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-brand-green/20 bg-white px-3 py-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={PRIMARY}>
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copié ✓" : "Copier le lien"}
        </button>
        {digits.length >= 8 && (
          <a
            href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-brand-green/30 bg-white px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Envoyer par WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function RecordPaymentForm({
  action,
  defaultAmount,
  today,
}: {
  action: Action;
  defaultAmount?: number;
  today: string;
}) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ServiceActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="grid gap-3 sm:grid-cols-2" data-testid="record-payment-form">
      <label className="block">
        <span className={LABEL}>Montant reçu (FCFA)</span>
        <input name="amount" type="text" inputMode="numeric" required defaultValue={defaultAmount ?? ""} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Moyen de paiement</span>
        <select name="method" defaultValue="mobile_money" className={INPUT}>
          {ADMIN_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Date du paiement</span>
        <input name="paidOn" type="date" required defaultValue={today} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Référence (identifiant de transaction, note…)</span>
        <input name="reference" type="text" maxLength={120} className={INPUT} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={PRIMARY}>
          <Check className="h-3.5 w-3.5" /> {pending ? "Enregistrement…" : "Enregistrer le paiement"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

/** Confirm or reject a payment the client submitted. Rejecting asks for a reason the client will see. */
export function ConfirmRejectButtons({
  confirmAction,
  rejectAction,
}: {
  confirmAction: () => Promise<ServiceActionState>;
  rejectAction: Action;
}) {
  const [confirmState, setConfirmState] = useState<ServiceActionState>({});
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const { state: rejectState, formAction: rejectFormAction, pending: rejectPending, onReset: onRejectReset } = useKeptFormAction<ServiceActionState>(rejectAction, {});
  return (
    <div className="space-y-2" data-testid="confirm-reject">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          data-testid="confirm-payment"
          onClick={() => startTransition(async () => setConfirmState(await confirmAction()))}
          className={PRIMARY}
        >
          <Check className="h-3.5 w-3.5" /> {pending ? "Confirmation…" : "Confirmer la réception"}
        </button>
        <button
          type="button"
          onClick={() => setRejecting((v) => !v)}
          data-testid="reject-payment"
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
        >
          <X className="h-3.5 w-3.5" /> Rejeter
        </button>
      </div>
      {rejecting && (
        <form action={rejectFormAction} onReset={onRejectReset} className="flex flex-wrap items-end gap-2">
          <label className="block min-w-48 flex-1">
            <span className={LABEL}>Motif du rejet (visible par le client)</span>
            <input name="reason" type="text" required maxLength={200} className={INPUT} />
          </label>
          <button type="submit" disabled={rejectPending} className="min-h-10 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
            Rejeter ce paiement
          </button>
        </form>
      )}
      <Result state={confirmState} />
      <Result state={rejectState} />
    </div>
  );
}

export function AdjustmentForm({ action }: { action: Action }) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ServiceActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="grid gap-3 sm:grid-cols-3" data-testid="adjustment-form">
      <label className="block">
        <span className={LABEL}>Type</span>
        <select name="kind" defaultValue="reduction" className={INPUT}>
          {(Object.keys(ADJUSTMENT_KIND_LABELS) as (keyof typeof ADJUSTMENT_KIND_LABELS)[]).map((k) => (
            <option key={k} value={k}>
              {ADJUSTMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Montant (FCFA)</span>
        <input name="amount" type="text" inputMode="numeric" required className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Motif (visible dans l&rsquo;historique)</span>
        <input name="reason" type="text" required maxLength={200} className={INPUT} />
      </label>
      <p className="text-[11px] text-ink/50 sm:col-span-3">
        Réduction et remboursement : nombre positif. Correction : positif (le client doit plus) ou négatif (le client
        doit moins). Une ligne ajoutée ne se supprime pas : pour la corriger, ajoutez la ligne inverse.
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Ajout…" : "Ajouter à l'historique"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function InstallmentsForm({
  action,
  installments,
}: {
  action: Action;
  installments: { label: string; dueDate: string }[];
}) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ServiceActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="space-y-3" data-testid="installments-form">
      {installments.map((inst, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className={LABEL}>Tranche {i + 1} — étiquette</span>
            <input name="label" type="text" maxLength={80} defaultValue={inst.label} placeholder="ex. avant mise en ligne" className={INPUT} />
          </label>
          <label className="block">
            <span className={LABEL}>Date limite</span>
            <input name="date" type="date" required defaultValue={inst.dueDate} className={INPUT} />
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Enregistrement…" : "Enregistrer les échéances"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function DetailsForm({
  action,
  goLiveDate,
  followupAmount,
  followupPeriod,
  note,
}: {
  action: Action;
  goLiveDate: string | null;
  followupAmount: number;
  followupPeriod: "month" | "quarter";
  note: string;
}) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ServiceActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="grid gap-3 sm:grid-cols-3" data-testid="details-form">
      <label className="block">
        <span className={LABEL}>Date de mise en ligne</span>
        <input name="goLiveDate" type="date" defaultValue={goLiveDate ?? ""} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Mensualité de suivi (FCFA)</span>
        <input name="followupAmount" type="text" inputMode="numeric" required defaultValue={followupAmount} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Payable</span>
        <select name="followupPeriod" defaultValue={followupPeriod} className={INPUT}>
          <option value="month">au mois</option>
          <option value="quarter">au trimestre</option>
        </select>
      </label>
      <label className="block sm:col-span-3">
        <span className={LABEL}>Note interne</span>
        <input name="note" type="text" maxLength={500} defaultValue={note} className={INPUT} />
      </label>
      <p className="text-[11px] text-ink/50 sm:col-span-3">
        Le suivi mensuel commence 12 mois après la mise en ligne. Son encaissement sera ajouté dans une prochaine étape :
        ces informations sont déjà conservées dans le dossier.
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RegenerateLinkForm({
  action,
  phone,
  merchantName,
}: {
  action: (previous: RegenerateLinkState, formData: FormData) => Promise<RegenerateLinkState>;
  phone?: string;
  merchantName?: string;
}) {
  const { state, formAction, pending, onReset } = useKeptFormAction<RegenerateLinkState>(action, {});
  return (
    <div className="space-y-3" data-testid="regenerate-link">
      <form action={formAction} onReset={onReset} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink/70">
          <input type="checkbox" name="confirm" value="yes" className="h-4 w-4" />
          Je comprends que l&rsquo;ancien lien cessera de fonctionner
        </label>
        <button type="submit" disabled={pending} className="min-h-10 rounded-full border border-brand-green/30 bg-white px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60">
          {pending ? "Création…" : "Créer un nouveau lien"}
        </button>
      </form>
      <Result state={state} />
      {state.link && <PrivateLinkBox link={state.link} phone={phone} merchantName={merchantName} />}
    </div>
  );
}
