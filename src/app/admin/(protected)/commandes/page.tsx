import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { WhatsappReminderButton } from "@/components/admin/whatsapp-reminder-button";
import {
  getAllOrders,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders-db";
import { ZONES, formatPrice } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-labels";
import { whatsappReminderHref } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Commandes — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  paymentStatus?: string;
  zone?: string;
  from?: string;
  to?: string;
  q?: string;
}

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = (sp.status || undefined) as OrderStatus | undefined;
  const paymentStatus = (sp.paymentStatus || undefined) as PaymentStatus | undefined;
  const zoneId = (sp.zone || undefined) as ZoneId | undefined;
  const search = sp.q?.trim() || undefined;

  const orders = await getAllOrders({
    status,
    paymentStatus,
    zoneId,
    dateFrom: sp.from || undefined,
    dateTo: sp.to || undefined,
    search,
    includeTest: true,
  });

  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (paymentStatus) exportParams.set("paymentStatus", paymentStatus);
  if (zoneId) exportParams.set("zone", zoneId);
  if (sp.from) exportParams.set("from", sp.from);
  if (sp.to) exportParams.set("to", sp.to);
  if (search) exportParams.set("q", search);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Commandes
        </h1>
        <a
          href={`/api/admin/orders/export?${exportParams.toString()}`}
          className="flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-white px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory"
        >
          <Download className="h-3.5 w-3.5" /> Export Excel
        </a>
      </div>

      <form className="mt-5 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Recherche (nom / numéro)
          </span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="AK-... ou nom"
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Statut
          </span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          >
            <option value="">Tous</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Paiement
          </span>
          <select
            name="paymentStatus"
            defaultValue={paymentStatus ?? ""}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          >
            <option value="">Tous</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Zone
          </span>
          <select
            name="zone"
            defaultValue={zoneId ?? ""}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          >
            <option value="">Toutes</option>
            {(Object.keys(ZONES) as ZoneId[]).map((z) => (
              <option key={z} value={z}>
                {ZONES[z].shortLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Du
          </span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            Au
          </span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to}
            className="w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
          />
        </label>

        <div className="flex items-end gap-2 lg:col-span-6">
          <button
            type="submit"
            className="rounded-full bg-brand-green px-5 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark"
          >
            Filtrer
          </button>
          <Link
            href="/admin/commandes"
            className="rounded-full border border-brand-green/20 px-5 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory"
          >
            Réinitialiser
          </Link>
          <Link
            href="/admin/commandes?paymentStatus=en_attente"
            className="ml-auto rounded-full bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600"
          >
            En attente de paiement
          </Link>
        </div>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-[11px] font-bold uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Date &amp; heure</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-brand-green/5 last:border-0 hover:bg-ivory/60"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/commandes/${order.id}`}
                    className="font-bold text-brand-green-dark hover:text-brand-green"
                  >
                    {order.id}
                  </Link>
                  {order.isTest && (
                    <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold text-ink/50">
                      TEST
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {new Date(order.createdAt).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-ink/70">{ZONES[order.zoneId].shortLabel}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">{order.customerName}</div>
                  <div className="text-xs text-ink/50">{order.customerPhone}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-ink">
                  {formatPrice(order.subtotal + order.shippingFee, order.zoneId)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}
                  >
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {order.paymentStatus === "en_attente" && (
                    <WhatsappReminderButton
                      orderId={order.id}
                      href={whatsappReminderHref(order)}
                      label="Relancer"
                      className="inline-flex items-center gap-1 rounded-full border border-brand-green/20 px-2.5 py-1 text-[11px] font-bold text-brand-green-dark hover:bg-ivory"
                    />
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink/50">
                  Aucune commande ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
