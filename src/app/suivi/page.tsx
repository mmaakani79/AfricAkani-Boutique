"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Package } from "lucide-react";
import { Container } from "@/components/layout/container";
import { trackOrderAction, type TrackingState } from "./actions";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-labels";
import { formatPrice } from "@/data/zones";

const initialState: TrackingState = {};

function TrackingForm() {
  const searchParams = useSearchParams();
  const prefilledOrderId = searchParams.get("commande") ?? "";
  const [state, formAction, pending] = useActionState(
    trackOrderAction,
    initialState
  );
  const order = state.order;

  return (
    <div className="mx-auto max-w-xl">
      <form action={formAction} className="space-y-4 rounded-2xl bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Numéro de commande
          </span>
          <input
            type="text"
            name="orderId"
            defaultValue={prefilledOrderId}
            required
            placeholder="AK-..."
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            E-mail ou téléphone utilisé pour la commande
          </span>
          <input
            type="text"
            name="contact"
            required
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> {pending ? "Recherche…" : "Suivre ma commande"}
        </button>
        {state.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {state.error}
          </p>
        )}
      </form>

      {order && (
        <div className="mt-6 space-y-4 rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-brand text-lg font-bold text-brand-green-dark">
              Commande {order.id}
            </h2>
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
          <p className="text-xs text-ink/50">
            {new Date(order.createdAt).toLocaleString("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>

          <ul className="space-y-1.5 border-t border-brand-green/10 pt-3 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-ink/70">
                  {item.quantity} × {item.productName}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatPrice(item.lineTotal, order.zoneId)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-brand-green/10 pt-3 text-sm">
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

          {order.paymentMethod === "mobile_money" &&
            order.paymentStatus === "en_verification" && (
              <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
                Votre paiement Mobile Money est en cours de vérification. Nous
                confirmons votre paiement sous 30 minutes en général, et au
                plus tard sous 2 heures.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

export default function SuiviPage() {
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-xl text-center">
        <Package className="mx-auto h-10 w-10 text-brand-gold" />
        <h1 className="mt-2 font-brand text-3xl font-bold text-brand-green-dark">
          Suivre ma commande
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Entrez votre numéro de commande et l&rsquo;e-mail ou le téléphone
          utilisé lors de la commande.
        </p>
      </div>
      <div className="mt-8">
        <Suspense fallback={null}>
          <TrackingForm />
        </Suspense>
      </div>
    </Container>
  );
}
