"use client";

import type { MobileMoneyConfig } from "@/lib/mobile-money-types";
import { operatorLogoSrc } from "@/lib/mobile-money-logos";

export function MobileMoneyPanel({
  config,
  orderId,
  amount,
  format,
  operatorId,
  onOperatorChange,
  phone,
  onPhoneChange,
  transactionId,
  onTransactionIdChange,
}: {
  config: MobileMoneyConfig;
  orderId: string;
  amount: number;
  format: (n: number) => string;
  operatorId: string;
  onOperatorChange: (id: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  transactionId: string;
  onTransactionIdChange: (v: string) => void;
}) {
  const selectedOperator = config.operators.find((op) => op.id === operatorId);

  return (
    <div className="space-y-4 rounded-xl border border-brand-green/15 bg-ivory p-4">
      <div>
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-gold">
          Opérateur
        </span>
        <div className="flex flex-wrap gap-2">
          {config.operators.map((op) => {
            const logoSrc = operatorLogoSrc(op.name);
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onOperatorChange(op.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                  operatorId === op.id
                    ? "border-brand-green bg-brand-green text-ivory"
                    : "border-brand-green/20 bg-white text-brand-green-dark"
                }`}
              >
                {logoSrc && (
                  // eslint-disable-next-line @next/next/no-img-element -- official operator logo, must render exactly as provided
                  <img
                    src={logoSrc}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded bg-white object-contain p-0.5"
                  />
                )}
                {op.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedOperator && (
        <div className="space-y-1.5 rounded-xl bg-white p-3.5 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-ink/60">Code de transfert marchand</span>
            <span className="font-bold text-brand-green-dark">
              {selectedOperator.merchantNumber || "—"}
            </span>
          </div>
          {config.beneficiaryName && (
            <div className="flex justify-between gap-2">
              <span className="text-ink/60">Bénéficiaire</span>
              <span className="font-semibold text-ink">{config.beneficiaryName}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-ink/60">Montant à envoyer</span>
            <span className="font-bold text-brand-green-dark">
              {format(amount)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink/60">Référence</span>
            <span className="font-semibold text-ink">{orderId}</span>
          </div>
          {selectedOperator.displayName && (
            <p className="border-t border-brand-green/10 pt-1.5 text-xs text-ink/60">
              Le nom qui s&rsquo;affichera sur votre téléphone :{" "}
              <span className="font-semibold text-ink">
                {selectedOperator.displayName}
              </span>
            </p>
          )}
        </div>
      )}

      <ol className="list-decimal space-y-1 pl-4 text-xs text-ink/70">
        <li>
          Sur votre téléphone, saisissez le code de transfert ci-dessus dans{" "}
          {selectedOperator?.name || "votre opérateur"} Mobile Money pour
          envoyer le montant exact.
        </li>
        <li>Notez l&rsquo;identifiant de transaction reçu par SMS.</li>
        <li>
          Indiquez votre numéro et cet identifiant ci-dessous, puis confirmez
          la commande.
        </li>
      </ol>

      <p className="rounded-lg bg-brand-green/10 px-3 py-2 text-xs font-semibold text-brand-green-dark">
        Nous confirmons votre paiement sous 30 minutes en général, et au plus
        tard sous 2 heures.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Votre numéro Mobile Money
          </span>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Identifiant de transaction (SMS)
          </span>
          <input
            type="text"
            required
            value={transactionId}
            onChange={(e) => onTransactionIdChange(e.target.value)}
            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
      </div>
    </div>
  );
}
