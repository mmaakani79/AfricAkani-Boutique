import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceAccountFull, getServiceEvents } from "@/lib/service-accounts-db";
import { getSignedContractById } from "@/lib/contracts-db";
import {
  ACCOUNT_STATUS_LABELS,
  ADJUSTMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  todayInBenin,
  type AccountStatus,
} from "@/lib/service-account-math";
import { PAYMENT_METHOD_LABELS } from "@/lib/service-validation";
import { dateFr, dateTimeFr, fcfa } from "@/lib/service-format";
import { buildReceiptForPayment } from "@/lib/service-receipts";
import { receiptWhatsappHref } from "@/lib/service-receipt";
import {
  AdjustmentForm,
  ConfirmRejectButtons,
  DetailsForm,
  InstallmentsForm,
  ReceiptControls,
  RecordPaymentForm,
  RegenerateLinkForm,
} from "@/components/admin/service-controls";
import {
  addAdjustmentAction,
  confirmPaymentAction,
  recordPaymentAction,
  regenerateLinkAction,
  rejectPaymentAction,
  resendReceiptAction,
  updateDetailsAction,
  updateInstallmentsAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Dossier de paiement — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<AccountStatus, string> = {
  en_cours: "bg-blue-600 text-white",
  solde: "bg-brand-green text-white",
  en_retard: "bg-red-600 text-white",
};

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-5" data-testid={testId}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function ServiceAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const full = await getServiceAccountFull(id);
  if (!full) notFound();
  const { account, state, payments, adjustments, installments } = full;
  const [events, contract] = await Promise.all([
    getServiceEvents(id),
    account.contractId ? getSignedContractById(account.contractId) : Promise.resolve(null),
  ]);
  const today = todayInBenin();
  const pending = payments.filter((p) => p.status === "soumis");

  return (
    <div data-testid="service-detail" data-account={account.id}>
      <Link href="/admin/services" className="text-xs font-semibold text-brand-green-dark hover:underline">
        ← Services
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl font-bold text-brand-green-dark [overflow-wrap:anywhere]">
            {account.merchantName}
          </h1>
          <p className="text-xs text-ink/50">
            {account.id} · créé le {dateTimeFr(account.createdAt)}
            {account.contractId && (
              <>
                {" "}
                · contrat {contract ? "signé" : "introuvable"} :{" "}
                <Link href="/admin/contrats" className="font-semibold text-brand-green-dark hover:underline">
                  {account.contractId}
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[state.status]}`} data-testid="detail-status">
          {ACCOUNT_STATUS_LABELS[state.status]}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="detail-totals">
        {[
          ["Prix total", fcfa(state.adjustedTotal), "total"],
          ["Payé", fcfa(Math.max(0, state.paid)), "paid"],
          ["Reste à payer", fcfa(state.remaining), "remaining"],
          ["En attente de confirmation", fcfa(state.pending), "pending"],
        ].map(([label, value, key]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{label}</p>
            <p className="mt-1 text-lg font-bold text-brand-green-dark" data-testid={`detail-${key}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
      {state.overpaid > 0 && (
        <p className="mt-2 text-xs font-semibold text-amber-800">Trop-perçu : {fcfa(state.overpaid)}.</p>
      )}

      {pending.length > 0 && (
        <Section title="Paiements à confirmer" testId="pending-section">
          <ul className="space-y-4">
            {pending.map((p) => (
              <li key={p.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4" data-testid="pending-payment">
                <p className="font-bold text-brand-green-dark">
                  {fcfa(p.amount)} — {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  {p.mmOperator ? ` (${p.mmOperator})` : ""}
                </p>
                <p className="text-xs text-ink/70">
                  Soumis le {dateTimeFr(p.createdAt)} · {p.id}
                </p>
                <p className="mt-1 text-xs text-ink/80">
                  Numéro du client : <span className="font-semibold">{p.mmPhone ?? "—"}</span> · Identifiant de transaction :{" "}
                  <span className="font-semibold">{p.mmTransactionId ?? "—"}</span>
                </p>
                {p.adminEmailError && (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    L&rsquo;e-mail de notification n&rsquo;a pas pu partir ({p.adminEmailError}) : ce paiement est ici et sur le
                    tableau de bord.
                  </p>
                )}
                <div className="mt-3">
                  <ConfirmRejectButtons
                    confirmAction={confirmPaymentAction.bind(null, account.id, p.id)}
                    rejectAction={rejectPaymentAction.bind(null, account.id, p.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Échéancier" testId="schedule-section">
        <ul className="divide-y divide-brand-green/10 text-sm">
          {state.schedule.map((l) => (
            <li key={l.position} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="font-semibold">{l.kind === "deposit" ? "Acompte" : l.label || `Tranche ${l.position}`}</span>
                <span className="block text-xs text-ink/50">{l.dueDate ? dateFr(l.dueDate) : "À la signature"}</span>
              </span>
              <span className="font-bold text-brand-green-dark">{fcfa(l.amount)}</span>
              <span className="text-xs text-ink/60">
                payé {fcfa(l.paid)} · {SCHEDULE_STATUS_LABELS[l.status]}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-brand-green/10 pt-4">
          <InstallmentsForm
            action={updateInstallmentsAction.bind(null, account.id)}
            installments={installments.map((i) => ({ label: i.label, dueDate: i.dueDate }))}
          />
        </div>
      </Section>

      <Section title="Enregistrer un paiement" testId="record-section">
        <p className="mb-3 text-xs text-ink/60">
          Pour un paiement reçu en dehors de la page du client (espèces, virement, Mobile Money reçu directement). Il est
          confirmé tout de suite.
        </p>
        <RecordPaymentForm
          action={recordPaymentAction.bind(null, account.id)}
          defaultAmount={state.next?.amount}
          today={today}
        />
      </Section>

      <Section title="Paiements" testId="payments-section">
        {payments.length === 0 ? (
          <p className="text-sm text-ink/50">Aucun paiement.</p>
        ) : (
          <ul className="divide-y divide-brand-green/10 text-sm" data-testid="payments-list">
            {[...payments].reverse().map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="font-semibold">
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    {p.mmOperator ? ` (${p.mmOperator})` : ""} · {p.source === "client" ? "soumis par le client" : "enregistré par vous"}
                  </span>
                  <span className="block text-xs text-ink/50">
                    {dateTimeFr(p.createdAt)} · {p.id}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.mmTransactionId ? ` · transaction ${p.mmTransactionId}` : ""}
                  </span>
                  {p.rejectReason && <span className="block text-xs text-red-700">Rejeté : {p.rejectReason}</span>}
                </span>
                <span className="font-bold text-brand-green-dark">{fcfa(p.amount)}</span>
                <span className="text-xs font-semibold text-ink/70">{PAYMENT_STATUS_LABELS[p.status]}</span>
                {p.status === "confirme" && (
                  <div className="w-full">
                    <ReceiptControls
                      resendAction={resendReceiptAction.bind(null, account.id, p.id)}
                      whatsappHref={receiptWhatsappHref(account.clientPhone, buildReceiptForPayment(full, p.id)?.whatsappText ?? "")}
                      sentAt={p.receiptSentAt}
                      error={p.receiptError}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ajustements (réductions, corrections, remboursements)" testId="adjustments-section">
        {adjustments.length === 0 ? (
          <p className="mb-3 text-sm text-ink/50">Aucun ajustement.</p>
        ) : (
          <ul className="mb-4 divide-y divide-brand-green/10 text-sm" data-testid="adjustments-list">
            {[...adjustments].reverse().map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="font-semibold">
                    {ADJUSTMENT_KIND_LABELS[a.kind]} — {a.reason}
                  </span>
                  <span className="block text-xs text-ink/50">
                    {dateTimeFr(a.createdAt)} · {a.id}
                  </span>
                </span>
                <span className="font-bold text-brand-green-dark">
                  {a.kind === "reduction" ? "− " : a.kind === "correction" && a.amount > 0 ? "+ " : a.kind === "correction" ? "− " : ""}
                  {fcfa(Math.abs(a.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <AdjustmentForm action={addAdjustmentAction.bind(null, account.id)} />
      </Section>

      <Section title="Informations du dossier" testId="details-section">
        <DetailsForm
          action={updateDetailsAction.bind(null, account.id)}
          clientName={account.clientName}
          clientEmail={account.clientEmail}
          clientPhone={account.clientPhone}
          goLiveDate={account.goLiveDate}
          followupAmount={account.followupAmount}
          followupPeriod={account.followupPeriod}
          note={account.note}
        />
      </Section>

      <Section title="Lien privé du client" testId="link-section">
        <p className="mb-3 text-xs text-ink/60">
          Dernier lien créé le {dateTimeFr(account.tokenCreatedAt)}. Il n&rsquo;est pas conservé en clair : pour en donner un
          nouveau au client, créez-le ici (l&rsquo;ancien cesse de fonctionner).
        </p>
        <RegenerateLinkForm
          action={regenerateLinkAction.bind(null, account.id)}
          phone={account.clientPhone || contract?.clientPhone}
          merchantName={account.merchantName}
        />
      </Section>

      <Section title="Journal" testId="events-section">
        <ul className="space-y-1.5 text-xs text-ink/70" data-testid="events-list">
          {events.map((e) => (
            <li key={e.id}>
              <span className="font-semibold text-ink/50">{dateTimeFr(e.createdAt)}</span> — {e.detail}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
