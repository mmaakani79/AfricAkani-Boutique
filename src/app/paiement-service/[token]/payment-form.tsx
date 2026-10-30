"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MobileMoneyConfig } from "@/lib/mobile-money-types";
import { operatorLogoSrc } from "@/lib/mobile-money-logos";
import { useKeptFormAction } from "@/components/use-kept-form-action";
import type { ServicePaymentFormState } from "./actions";

const INITIAL: ServicePaymentFormState = {};

/** The client declares a Mobile Money payment they just made: it waits for AkaGest's confirmation. */
export function ServicePaymentForm({
  action,
  config,
  suggestedAmount,
  maxAmount,
  reference,
}: {
  action: (previous: ServicePaymentFormState, formData: FormData) => Promise<ServicePaymentFormState>;
  config: MobileMoneyConfig;
  suggestedAmount: number;
  maxAmount: number;
  reference: string;
}) {
  const router = useRouter();
  const { state, formAction, pending, onReset } = useKeptFormAction(action, INITIAL);
  const [operatorId, setOperatorId] = useState(config.operators[0]?.id ?? "");
  const [amount, setAmount] = useState(String(suggestedAmount));
  const selected = config.operators.find((op) => op.id === operatorId);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (state.ok) {
    return (
      <p
        role="status"
        data-testid="service-payment-success"
        className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-semibold text-brand-green-dark"
      >
        {state.message}
      </p>
    );
  }

  if (config.operators.length === 0) {
    return (
      <p className="rounded-xl bg-ivory px-4 py-3 text-sm text-ink/70">
        Le paiement en ligne n&rsquo;est pas disponible pour le moment. Contactez AkaGest pour régler.
      </p>
    );
  }

  return (
    <form action={formAction} onReset={onReset} className="space-y-4" data-testid="service-payment-form">
      <div>
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-gold">Opérateur</span>
        <div className="flex flex-wrap gap-2">
          {config.operators.map((op) => {
            const logo = operatorLogoSrc(op.name);
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperatorId(op.id)}
                aria-pressed={operatorId === op.id}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${
                  operatorId === op.id
                    ? "border-brand-green bg-brand-green text-ivory"
                    : "border-brand-green/20 bg-white text-brand-green-dark"
                }`}
              >
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- official operator logo, shown as provided
                  <img src={logo} alt="" className="h-5 w-5 shrink-0 rounded bg-white object-contain p-0.5" />
                )}
                {op.name}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="operatorId" value={operatorId} />
      </div>

      {selected && (
        <div className="space-y-1.5 rounded-xl bg-ivory p-3.5 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-ink/60">Code de transfert marchand</span>
            <span className="font-bold text-brand-green-dark" data-testid="merchant-code">
              {selected.merchantNumber || "—"}
            </span>
          </div>
          {config.beneficiaryName && (
            <div className="flex justify-between gap-2">
              <span className="text-ink/60">Bénéficiaire</span>
              <span className="text-right font-semibold text-ink">{config.beneficiaryName}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-ink/60">Référence</span>
            <span className="font-semibold text-ink">{reference}</span>
          </div>
          {selected.displayName && (
            <p className="border-t border-brand-green/10 pt-1.5 text-xs text-ink/60">
              Le nom qui s&rsquo;affichera sur votre téléphone :{" "}
              <span className="font-semibold text-ink">{selected.displayName}</span>
            </p>
          )}
        </div>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-xs text-ink/70">
        <li>
          Sur votre téléphone, saisissez le code de transfert ci-dessus dans{" "}
          {selected?.name || "votre opérateur"} Mobile Money et envoyez le montant exact.
        </li>
        <li>Notez l&rsquo;identifiant de transaction reçu par SMS.</li>
        <li>Indiquez le montant envoyé, votre numéro et cet identifiant ci-dessous.</li>
      </ol>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Montant envoyé (FCFA)</span>
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-3 text-base outline-none focus:border-brand-green"
          />
          <span className="mt-1 block text-[11px] text-ink/50">
            Au plus {maxAmount.toLocaleString("fr-FR")} FCFA (le reste à payer).
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Votre numéro Mobile Money</span>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-3 text-base outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Identifiant de transaction (SMS)</span>
          <input
            name="transactionId"
            type="text"
            required
            autoComplete="off"
            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-3 text-base outline-none focus:border-brand-green"
          />
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          data-testid="service-payment-error"
          className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Envoi…" : "J'ai envoyé le paiement"}
      </button>
      <p className="text-center text-[11px] text-ink/50">
        Nous vérifions la réception avant de confirmer. Votre paiement apparaît « en attente » jusque-là.
      </p>
    </form>
  );
}
