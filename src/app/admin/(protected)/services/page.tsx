import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { listServiceAccounts, type ServiceAccountSummary } from "@/lib/service-accounts-db";
import {
  ACCOUNT_STATUS_LABELS,
  todayInBenin,
  type AccountStatus,
} from "@/lib/service-account-math";
import { dateFr, fcfa } from "@/lib/service-format";
import { RecordPaymentForm } from "@/components/admin/service-controls";
import { recordPaymentAction } from "./actions";

export const metadata: Metadata = {
  title: "Services — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<AccountStatus, string> = {
  en_cours: "bg-blue-600 text-white",
  solde: "bg-brand-green text-white",
  en_retard: "bg-red-600 text-white",
};

type Filter = "tous" | AccountStatus | "a_confirmer";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "en_cours", label: "En cours" },
  { value: "en_retard", label: "En retard" },
  { value: "solde", label: "Soldés" },
  { value: "a_confirmer", label: "À confirmer" },
];

function matches(a: ServiceAccountSummary, filter: Filter, q: string): boolean {
  if (filter === "a_confirmer" ? a.pendingCount === 0 : filter !== "tous" && a.state.status !== filter) return false;
  if (q && !`${a.account.merchantName} ${a.account.id}`.toLowerCase().includes(q.toLowerCase())) return false;
  return true;
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.value === sp.status) ? sp.status : "tous") as Filter;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const all = await listServiceAccounts();
  const rows = all.filter((a) => matches(a, filter, q));
  const today = todayInBenin();

  const totals = {
    count: all.length,
    collected: all.reduce((s, a) => s + Math.max(0, a.state.paid), 0),
    remaining: all.reduce((s, a) => s + a.state.remaining, 0),
    late: all.filter((a) => a.state.status === "en_retard").length,
    pending: all.reduce((s, a) => s + a.pendingCount, 0),
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">Services</h1>
        <Link
          href="/admin/services/nouveau"
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau dossier
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Paiements des services AkaGest : un dossier par marchand. Ces montants sont à part, ils ne comptent pas dans les
        ventes de la boutique.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="services-totals">
        {[
          ["Dossiers", String(totals.count)],
          ["Encaissé", fcfa(totals.collected)],
          ["Reste à payer", fcfa(totals.remaining)],
          ["En retard", String(totals.late)],
          ["À confirmer", String(totals.pending)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{label}</p>
            <p className="mt-1 text-lg font-bold text-brand-green-dark">{value}</p>
          </div>
        ))}
      </div>

      <form className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4">
        <label className="block min-w-48 flex-1">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">Recherche (marchand ou numéro)</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">Statut</span>
          <select
            name="status"
            defaultValue={filter}
            className="rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark">
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink/50" data-testid="services-empty">
          {all.length === 0 ? "Aucun dossier pour le moment." : "Aucun dossier ne correspond à ce filtre."}
        </p>
      ) : (
        <ul className="mt-5 space-y-3" data-testid="services-list">
          {rows.map((a) => (
            <li key={a.account.id} className="rounded-2xl bg-white p-4" data-testid="service-row" data-account={a.account.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/services/${a.account.id}`}
                    className="font-bold text-brand-green-dark hover:underline [overflow-wrap:anywhere]"
                  >
                    {a.account.merchantName}
                  </Link>
                  <p className="text-[11px] text-ink/50">{a.account.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900" data-testid="pending-badge">
                      {a.pendingCount} à confirmer
                    </span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[a.state.status]}`} data-testid="row-status">
                    {ACCOUNT_STATUS_LABELS[a.state.status]}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-[11px] text-ink/50">Total</dt>
                  <dd className="font-semibold text-ink">{fcfa(a.state.adjustedTotal)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink/50">Payé</dt>
                  <dd className="font-semibold text-ink">{fcfa(Math.max(0, a.state.paid))}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink/50">Reste à payer</dt>
                  <dd className="font-bold text-brand-green-dark" data-testid="row-remaining">
                    {fcfa(a.state.remaining)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink/50">Prochaine échéance</dt>
                  <dd className="font-semibold text-ink" data-testid="row-next">
                    {a.state.next
                      ? `${a.state.next.kind === "deposit" ? "Acompte" : a.state.next.label || `Tranche ${a.state.next.position}`} — ${a.state.next.dueDate ? dateFr(a.state.next.dueDate) : "maintenant"} — ${fcfa(a.state.next.amount)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <details className="mt-3">
                <summary className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-brand-green/30 px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory">
                  Enregistrer un paiement
                </summary>
                <div className="mt-3 rounded-xl bg-ivory p-3">
                  <RecordPaymentForm
                    action={recordPaymentAction.bind(null, a.account.id)}
                    defaultAmount={a.state.next?.amount}
                    today={today}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
