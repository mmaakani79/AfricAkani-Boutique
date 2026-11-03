import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getServiceAccountByToken } from "@/lib/service-accounts-db";
import { signedContractExists } from "@/lib/contracts-db";
import { getMobileMoneyConfig } from "@/lib/mobile-money-db";
import {
  ACCOUNT_STATUS_LABELS,
  ADJUSTMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  type AccountStatus,
  type ScheduleStatus,
} from "@/lib/service-account-math";
import { PAYMENT_METHOD_LABELS } from "@/lib/service-validation";
import { dateFr, dateTimeFr, fcfa } from "@/lib/service-format";
import { ReceiptSlogan } from "@/components/receipt-slogan";
import { PROVIDER_LINE } from "@/lib/service-receipt";
import { ServicePaymentForm } from "./payment-form";
import { submitServicePaymentAction } from "./actions";

// A client's private payment page. Nothing else of the site is shown here (see SiteChrome),
// it is never indexed, never cached, and never sends its address to another site.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dossier de paiement",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const STATUS_STYLE: Record<AccountStatus, string> = {
  en_cours: "bg-blue-600 text-white",
  solde: "bg-brand-green text-white",
  en_retard: "bg-red-600 text-white",
};

const LINE_STYLE: Record<ScheduleStatus, string> = {
  paye: "bg-brand-green/10 text-brand-green-dark",
  partiel: "bg-amber-100 text-amber-900",
  a_payer: "bg-ink/5 text-ink/70",
  en_retard: "bg-red-100 text-red-700",
};

export default async function ServicePrivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const full = await getServiceAccountByToken(token);
  if (!full) notFound();

  const { account, state, payments, adjustments } = full;
  const [config, hasContract] = await Promise.all([
    getMobileMoneyConfig(),
    account.contractId ? signedContractExists(account.contractId) : Promise.resolve(false),
  ]);

  const payable = state.remaining - state.pending;
  const progress = state.adjustedTotal > 0 ? Math.min(100, Math.round((Math.max(0, state.paid) / state.adjustedTotal) * 100)) : 100;

  type Entry =
    | { at: string; kind: "payment"; payment: (typeof payments)[number] }
    | { at: string; kind: "adjustment"; adjustment: (typeof adjustments)[number] };
  const history: Entry[] = [
    ...payments.map((payment) => ({ at: payment.createdAt, kind: "payment" as const, payment })),
    ...adjustments.map((adjustment) => ({ at: adjustment.createdAt, kind: "adjustment" as const, adjustment })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8" data-testid="service-private-page">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">Dossier de paiement</p>
        <h1 className="mt-1 font-brand text-3xl font-bold text-brand-green-dark [overflow-wrap:anywhere]">
          {account.merchantName}
        </h1>
        <span
          data-testid="account-status"
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[state.status]}`}
        >
          {ACCOUNT_STATUS_LABELS[state.status]}
        </span>
      </header>

      <section className="mt-6 rounded-2xl bg-white p-5" aria-label="Résumé">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-ivory p-3 text-center">
            <dt className="text-xs text-ink/60">Prix total</dt>
            <dd className="mt-0.5 text-lg font-bold text-brand-green-dark" data-testid="total">
              {fcfa(state.adjustedTotal)}
            </dd>
          </div>
          <div className="rounded-xl bg-ivory p-3 text-center">
            <dt className="text-xs text-ink/60">Déjà payé</dt>
            <dd className="mt-0.5 text-lg font-bold text-brand-green-dark" data-testid="paid">
              {fcfa(Math.max(0, state.paid))}
            </dd>
          </div>
          <div className="rounded-xl bg-brand-gold/15 p-3 text-center">
            <dt className="text-xs text-ink/60">Reste à payer</dt>
            <dd className="mt-0.5 text-lg font-bold text-brand-green-dark" data-testid="remaining">
              {fcfa(state.remaining)}
            </dd>
          </div>
        </dl>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Part payée"
        >
          <div className="h-full rounded-full bg-brand-green" style={{ width: `${progress}%` }} />
        </div>
        {state.reductions > 0 && (
          <p className="mt-3 text-xs text-ink/60">
            Dont réductions accordées : {fcfa(state.reductions)} (détail dans l&rsquo;historique).
          </p>
        )}
        {state.pending > 0 && (
          <p className="mt-2 text-xs font-semibold text-amber-800" data-testid="pending-note">
            {fcfa(state.pending)} en attente de confirmation : pas encore compté dans « Déjà payé ».
          </p>
        )}
        {state.overpaid > 0 && (
          <p className="mt-2 text-xs font-semibold text-brand-green-dark">
            Vous avez payé {fcfa(state.overpaid)} de plus que le total : nous vous contacterons.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5" aria-label="Prochaine échéance">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Prochaine échéance</h2>
        {state.next ? (
          <p className="mt-2 text-base text-ink/80" data-testid="next-due">
            <span className="font-bold text-brand-green-dark">
              {state.next.kind === "deposit"
                ? "Acompte"
                : state.next.label || `Tranche ${state.next.position}`}
            </span>
            {" — "}
            {state.next.dueDate ? `à régler avant le ${dateFr(state.next.dueDate)}` : "à régler maintenant"}
            {" : "}
            <span className="font-bold text-brand-green-dark">{fcfa(state.next.amount)}</span>
          </p>
        ) : (
          <p className="mt-2 text-base font-semibold text-brand-green-dark" data-testid="next-due">
            Tout est réglé. Merci !
          </p>
        )}

        <ul className="mt-4 divide-y divide-brand-green/10 text-sm" data-testid="schedule">
          {state.schedule.map((line) => (
            <li key={line.position} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="font-semibold text-ink">
                  {line.kind === "deposit" ? "Acompte" : line.label || `Tranche ${line.position}`}
                </span>
                <span className="block text-xs text-ink/55">
                  {line.dueDate ? dateFr(line.dueDate) : "À la signature"}
                </span>
              </span>
              <span className="font-bold text-brand-green-dark">{fcfa(line.amount)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${LINE_STYLE[line.status]}`}>
                {SCHEDULE_STATUS_LABELS[line.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5" aria-label="Payer">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Envoyer un paiement</h2>
        {payable > 0 ? (
          <div className="mt-3">
            <ServicePaymentForm
              action={submitServicePaymentAction.bind(null, token)}
              config={config}
              suggestedAmount={Math.min(state.next?.amount ?? payable, payable)}
              maxAmount={payable}
              reference={account.id}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/70" data-testid="no-payment-needed">
            {state.remaining === 0
              ? "Rien à payer : votre dossier est soldé."
              : "Un paiement qui couvre le reste à payer attend déjà d'être confirmé."}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5" aria-label="Historique">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Historique</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60" data-testid="history-empty">
            Aucun paiement pour le moment.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-green/10 text-sm" data-testid="history">
            {history.map((entry) =>
              entry.kind === "payment" ? (
                <li key={entry.payment.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <span className="font-semibold text-ink">
                      Paiement — {PAYMENT_METHOD_LABELS[entry.payment.method] ?? entry.payment.method}
                      {entry.payment.mmOperator ? ` (${entry.payment.mmOperator})` : ""}
                    </span>
                    <span className="block text-xs text-ink/55">{dateTimeFr(entry.payment.createdAt)}</span>
                    {entry.payment.status === "rejete" && entry.payment.rejectReason && (
                      <span className="block text-xs text-red-700">Motif : {entry.payment.rejectReason}</span>
                    )}
                  </span>
                  <span className="font-bold text-brand-green-dark">{fcfa(entry.payment.amount)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      entry.payment.status === "confirme"
                        ? "bg-brand-green/10 text-brand-green-dark"
                        : entry.payment.status === "soumis"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {PAYMENT_STATUS_LABELS[entry.payment.status]}
                  </span>
                </li>
              ) : (
                <li key={entry.adjustment.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <span className="font-semibold text-ink">
                      {ADJUSTMENT_KIND_LABELS[entry.adjustment.kind]} — {entry.adjustment.reason}
                    </span>
                    <span className="block text-xs text-ink/55">{dateTimeFr(entry.adjustment.createdAt)}</span>
                  </span>
                  <span className="font-bold text-brand-green-dark">
                    {entry.adjustment.kind === "reduction"
                      ? `− ${fcfa(entry.adjustment.amount)}`
                      : entry.adjustment.kind === "remboursement"
                        ? `${fcfa(entry.adjustment.amount)} remboursés`
                        : `${entry.adjustment.amount > 0 ? "+ " : "− "}${fcfa(Math.abs(entry.adjustment.amount))}`}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5" aria-label="Facture">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Votre facture</h2>
        <a
          href={`/paiement-service/${token}/facture`}
          data-testid="invoice-link"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-brand-green px-4 py-2 text-sm font-bold text-brand-green-dark hover:bg-ivory"
        >
          <FileText className="h-4 w-4" aria-hidden /> Télécharger la facture (PDF)
        </a>
        {state.remaining > 0 && (
          <p className="mt-2 text-xs text-ink/60">Elle indique ce qui est déjà payé et le solde restant à régler.</p>
        )}
      </section>

      {hasContract && (
        <section className="mt-4 rounded-2xl bg-white p-5" aria-label="Contrat">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Votre contrat</h2>
          <a
            href={`/paiement-service/${token}/contrat`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="contract-link"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-brand-green px-4 py-2 text-sm font-bold text-brand-green-dark hover:bg-ivory"
          >
            <FileText className="h-4 w-4" aria-hidden /> Voir mon contrat signé (PDF, lecture seule)
          </a>
        </section>
      )}

      <ReceiptSlogan>
        <p>{PROVIDER_LINE}</p>
      </ReceiptSlogan>
    </div>
  );
}
