import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText } from "lucide-react";
import { formatOrderAddress, getOrderById } from "@/lib/orders-db";
import { ZONES, formatPrice } from "@/data/zones";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-labels";
import { whatsappPaymentConfirmedHref, whatsappReminderHref } from "@/lib/whatsapp";
import {
  WhatsappPaymentConfirmedButton,
  WhatsappReminderButton,
} from "@/components/admin/whatsapp-reminder-button";
import {
  DeleteOrderButton,
  MarkTestButton,
  MobileMoneyVerifyButtons,
  OrderPaymentForm,
  OrderStatusForm,
} from "./order-controls";

export const metadata: Metadata = {
  title: "Détail commande — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const REMINDER_KIND_LABELS: Record<string, string> = {
  reminder_24h: "Rappel automatique (24 h)",
  reminder_48h: "Rappel automatique (48 h)",
  whatsapp_manual: "Relance WhatsApp manuelle",
  whatsapp_payment_confirmed: "Confirmation de paiement WhatsApp",
  cancellation: "Annulation automatique",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <div>
      <Link
        href="/admin/commandes"
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-green-dark hover:text-brand-green"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux commandes
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
            Commande {order.id}
            {order.isTest && (
              <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 align-middle text-[11px] font-bold text-ink/50">
                TEST
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-ink/50">
            {new Date(order.createdAt).toLocaleString("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            })}{" "}
            — {ZONES[order.zoneId].label}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}
          >
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${ORDER_STATUS_COLORS[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>

      {order.emailError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-600">
            E-mail non envoyé : {order.emailError}
          </p>
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              Articles
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-green/10 text-[11px] font-bold uppercase text-ink/50">
                    <th className="py-2">Produit</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2 text-right">Qté</th>
                    <th className="py-2 text-right">Prix unitaire</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-b border-brand-green/5 last:border-0">
                      <td className="py-2 font-semibold text-ink">{item.productName}</td>
                      <td className="py-2 text-ink/50">{item.productSku ?? "—"}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">
                        {formatPrice(item.unitPrice, order.zoneId)}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {formatPrice(item.lineTotal, order.zoneId)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-brand-green/10 pt-3 text-sm">
              <div className="flex justify-between text-ink/70">
                <span>Sous-total</span>
                <span>{formatPrice(order.subtotal, order.zoneId)}</span>
              </div>
              <div className="flex justify-between text-ink/70">
                <span>Livraison</span>
                <span>
                  {order.shippingFee > 0
                    ? formatPrice(order.shippingFee, order.zoneId)
                    : "Gratuite"}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-brand-green-dark">
                <span>Total</span>
                <span>
                  {formatPrice(order.subtotal + order.shippingFee, order.zoneId)}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink/50">
              Mode de paiement :{" "}
              {order.paymentMethod === "whatsapp"
                ? "confirmé par WhatsApp"
                : order.paymentMethod === "mobile_money"
                  ? "Mobile Money"
                  : order.paymentMethod === "stripe"
                    ? "Carte bancaire (Stripe)"
                    : order.paymentMethod || "non renseigné"}
            </p>
          </section>

          {order.paymentMethod === "stripe" && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
                Stripe
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink/50">Session Checkout</dt>
                  <dd className="break-all text-sm font-semibold text-ink">
                    {order.stripeCheckoutSessionId ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Paiement (payment intent)</dt>
                  <dd className="break-all text-sm font-semibold text-ink">
                    {order.stripePaymentIntentId ?? "—"}
                  </dd>
                </div>
              </dl>
              {order.stripePaymentIntentId && (
                <a
                  href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-brand-green-dark underline-offset-2 hover:underline"
                >
                  Voir sur le tableau de bord Stripe →
                </a>
              )}
            </section>
          )}

          {order.paymentMethod === "mobile_money" && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
                Mobile Money
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink/50">Opérateur</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {order.mobileMoneyOperator ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Numéro client</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {order.mobileMoneyPhone ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Identifiant de transaction</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {order.mobileMoneyTransactionId ?? "—"}
                  </dd>
                </div>
              </dl>
              {order.paymentStatus === "en_verification" && (
                <div className="mt-4">
                  <MobileMoneyVerifyButtons orderId={order.id} />
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              Statut de la commande
            </h2>
            <div className="mt-3">
              <OrderStatusForm orderId={order.id} currentStatus={order.status} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              État du paiement
            </h2>
            <div className="mt-3">
              <OrderPaymentForm
                orderId={order.id}
                currentPaymentStatus={order.paymentStatus}
                currentPaymentMethod={order.paymentMethod}
              />
            </div>
          </section>

          {order.paymentStatus === "paye" && (
            <section className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
                Confirmation client
              </h2>
              <p className="mt-1 text-xs text-ink/60">
                Prévenez immédiatement le client sur WhatsApp que son
                paiement a bien été reçu.
              </p>
              <div className="mt-3">
                <WhatsappPaymentConfirmedButton
                  orderId={order.id}
                  href={whatsappPaymentConfirmedHref(order)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark"
                />
              </div>
            </section>
          )}

          {order.paymentStatus === "en_attente" && (
            <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
                Relance paiement
              </h2>
              <div className="mt-3">
                <WhatsappReminderButton
                  orderId={order.id}
                  href={whatsappReminderHref(order)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark"
                />
              </div>
              {order.reminders.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-xs text-ink/60">
                  {order.reminders.map((r) => (
                    <li key={r.id}>
                      {REMINDER_KIND_LABELS[r.kind] ?? r.kind} —{" "}
                      {new Date(r.sentAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              Client
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-ink/50">Nom</dt>
                <dd className="font-semibold text-ink">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Téléphone</dt>
                <dd className="font-semibold text-ink">{order.customerPhone}</dd>
              </div>
              <div>
                <dt className="text-ink/50">E-mail</dt>
                <dd className="font-semibold text-ink">{order.customerEmail || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Adresse de livraison</dt>
                <dd className="font-semibold text-ink">
                  {formatOrderAddress(order)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              Actions
            </h2>
            <a
              href={`/api/admin/orders/${order.id}/facture`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-xs font-bold text-ink/60 hover:bg-ivory"
            >
              <FileText className="h-3.5 w-3.5" /> Télécharger la facture (PDF)
            </a>
            <MarkTestButton orderId={order.id} isTest={order.isTest} />
            <DeleteOrderButton orderId={order.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
