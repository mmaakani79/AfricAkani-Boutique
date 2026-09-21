import Link from "next/link";
import type { Metadata } from "next";
import {
  ShoppingBag,
  TrendingUp,
  Truck,
  Package,
  CalendarDays,
  Clock,
  Mail,
} from "lucide-react";
import { getDashboardStats } from "@/lib/orders-db";
import { ZONES, formatPrice } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import { TestEmailButton } from "@/components/admin/test-email-button";

export const metadata: Metadata = {
  title: "Tableau de bord — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStats();
  const revenueByZone = new Map(
    stats.revenueByZone.map((r) => [r.zoneId, r])
  );

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Tableau de bord
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Commandes payées"
          value={String(stats.orderCount)}
        />
        {(Object.keys(ZONES) as ZoneId[]).map((zoneId) => (
          <StatCard
            key={zoneId}
            icon={TrendingUp}
            label={`Chiffre d'affaires produits — ${ZONES[zoneId].shortLabel}`}
            value={formatPrice(revenueByZone.get(zoneId)?.productTotal ?? 0, zoneId)}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink/40">
        Le chiffre d&rsquo;affaires et les produits les plus vendus ne
        comptent que les commandes payées et hors commandes marquées « test ».
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {(Object.keys(ZONES) as ZoneId[]).map((zoneId) => (
          <StatCard
            key={zoneId}
            icon={Truck}
            label={`Frais de livraison encaissés — ${ZONES[zoneId].shortLabel}`}
            value={formatPrice(revenueByZone.get(zoneId)?.shippingTotal ?? 0, zoneId)}
          />
        ))}
      </div>

      {stats.pendingPaymentCount > 0 && (
        <Link
          href="/admin/commandes?paymentStatus=en_attente"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-5 hover:bg-brand-gold/15"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-brand-gold" />
            <div>
              <p className="text-sm font-bold text-brand-green-dark">
                {stats.pendingPaymentCount} commande
                {stats.pendingPaymentCount > 1 ? "s" : ""} en attente de
                paiement
              </p>
              <p className="mt-0.5 text-xs text-ink/60">
                {stats.pendingPaymentByZone
                  .map(
                    (z) =>
                      `${z.count} en ${ZONES[z.zoneId].shortLabel} (${formatPrice(z.total, z.zoneId)})`
                  )
                  .join(" · ")}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-gold px-4 py-2 text-xs font-bold text-brand-green-dark">
            Voir ces commandes →
          </span>
        </Link>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
            <Package className="h-4 w-4" /> Produits les plus vendus
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">
              Aucune vente enregistrée pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.topProducts.map((p, i) => (
                <li
                  key={p.productId}
                  className="flex items-center justify-between rounded-lg bg-ivory px-3 py-2 text-sm"
                >
                  <span className="text-ink/70">
                    <span className="mr-2 font-bold text-brand-gold">
                      #{i + 1}
                    </span>
                    {p.name}
                  </span>
                  <span className="font-bold text-brand-green-dark">
                    {p.quantity} vendu{p.quantity > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
            <CalendarDays className="h-4 w-4" /> Commandes récentes (14 derniers jours)
          </h2>
          {stats.ordersByDay.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">
              Aucune commande enregistrée pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.ordersByDay.map((d) => (
                <li
                  key={d.day}
                  className="flex items-center justify-between rounded-lg bg-ivory px-3 py-2 text-sm"
                >
                  <span className="text-ink/70">
                    {new Date(d.day).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-bold text-brand-green-dark">
                    {d.count} commande{d.count > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
          <Mail className="h-4 w-4" /> Diagnostic e-mail
        </h2>
        <p className="mt-2 text-xs text-ink/50">
          Envoie un e-mail à l&rsquo;adresse admin pour vérifier que Resend
          est bien configuré et affiche le résultat exact (succès ou raison
          précise de l&rsquo;échec).
        </p>
        <div className="mt-3">
          <TestEmailButton />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-brand-green" />
      <p className="mt-2 text-xs font-semibold text-ink/50">{label}</p>
      <p className="mt-0.5 font-brand text-xl font-bold text-brand-green-dark">
        {value}
      </p>
    </div>
  );
}
