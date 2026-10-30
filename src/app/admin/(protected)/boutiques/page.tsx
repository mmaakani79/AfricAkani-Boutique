import Link from "next/link";
import type { Metadata } from "next";
import { listClientShops } from "@/lib/client-shops-db";
import { listServiceAccounts } from "@/lib/service-accounts-db";
import { SHOP_STATUS_LABELS, SHOP_STATUSES, type ShopStatus } from "@/lib/shop-status";
import { dateTimeFr } from "@/lib/service-format";
import { CreateShopForm } from "@/components/admin/shop-controls";
import { SHOP_STATUS_STYLE } from "@/components/admin/shop-status-style";
import { createShopAction } from "./actions";

export const metadata: Metadata = {
  title: "Boutiques clientes — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminShopsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const filter = SHOP_STATUSES.find((s) => s === sp.status) ?? null;
  const [all, accounts] = await Promise.all([listClientShops(), listServiceAccounts()]);
  const shops = filter ? all.filter((s) => s.status === filter) : all;
  const counts = Object.fromEntries(SHOP_STATUSES.map((s) => [s, all.filter((x) => x.status === s).length])) as Record<ShopStatus, number>;

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">Boutiques clientes</h1>
      <p className="mt-1 text-sm text-ink/60">
        L&rsquo;interrupteur des boutiques que vous créez pour vos clients. Aucun changement n&rsquo;est automatique : vous
        suspendez et réactivez à la main, avec un motif et un journal.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="shop-filters">
        <Link href="/admin/boutiques" className={`rounded-full border px-4 py-2 text-xs font-bold ${!filter ? "border-brand-green bg-brand-green text-ivory" : "border-brand-green/20 bg-white text-brand-green-dark"}`}>
          Toutes ({all.length})
        </Link>
        {SHOP_STATUSES.map((s) => (
          <Link key={s} href={`/admin/boutiques?status=${s}`} className={`rounded-full border px-4 py-2 text-xs font-bold ${filter === s ? "border-brand-green bg-brand-green text-ivory" : "border-brand-green/20 bg-white text-brand-green-dark"}`}>
            {SHOP_STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {shops.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink/50" data-testid="shops-empty">
          {all.length === 0 ? "Aucune boutique cliente pour le moment." : "Aucune boutique dans cet état."}
        </p>
      ) : (
        <ul className="mt-5 space-y-3" data-testid="shops-list">
          {shops.map((s) => (
            <li key={s.id} className="rounded-2xl bg-white p-4" data-testid="shop-row" data-shop={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/admin/boutiques/${s.id}`} className="font-bold text-brand-green-dark hover:underline [overflow-wrap:anywhere]">
                    {s.name}
                  </Link>
                  <p className="text-[11px] text-ink/50 [overflow-wrap:anywhere]">
                    {s.id}
                    {s.domain ? ` · ${s.domain}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${SHOP_STATUS_STYLE[s.status]}`} data-testid="shop-status">
                  {SHOP_STATUS_LABELS[s.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink/60">
                Changé le {dateTimeFr(s.statusChangedAt)}
                {s.status === "suspendu" && s.deleteAfter ? ` · données conservées jusqu'au ${s.deleteAfter}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-6 rounded-2xl bg-white p-5" data-testid="create-shop-details">
        <summary className="cursor-pointer text-sm font-bold text-brand-green-dark">Ajouter une boutique cliente</summary>
        <div className="mt-4">
          <CreateShopForm
            action={createShopAction}
            accounts={accounts.map((a) => ({ id: a.account.id, label: `${a.account.merchantName} (${a.account.id})` }))}
          />
        </div>
      </details>
    </div>
  );
}
