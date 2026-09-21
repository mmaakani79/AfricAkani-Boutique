"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteOrderAction,
  setOrderTestAction,
  updateOrderPaymentAction,
  updateOrderStatusAction,
  type OrderActionState,
} from "../actions";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-labels";

const initialState: OrderActionState = {};

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const action = updateOrderStatusAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        key={currentStatus}
        name="status"
        defaultValue={currentStatus}
        className="rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "…" : "Mettre à jour le statut"}
      </button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      <p className="w-full text-[11px] text-ink/50">
        Passer à « Expédiée » envoie automatiquement un e-mail au client.
      </p>
    </form>
  );
}

export function OrderPaymentForm({
  orderId,
  currentPaymentStatus,
  currentPaymentMethod,
}: {
  orderId: string;
  currentPaymentStatus: PaymentStatus;
  currentPaymentMethod: string | null;
}) {
  const action = updateOrderPaymentAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        key={currentPaymentStatus}
        name="paymentStatus"
        defaultValue={currentPaymentStatus}
        className="rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
      >
        {PAYMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PAYMENT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        key={currentPaymentMethod ?? ""}
        name="paymentMethod"
        defaultValue={currentPaymentMethod ?? ""}
        className="rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green"
      >
        <option value="">Mode de paiement…</option>
        <option value="livraison">Paiement à la livraison</option>
        <option value="whatsapp">Confirmé par WhatsApp</option>
        <option value="autre">Autre</option>
      </select>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-ink/70">
        <input type="checkbox" name="confirm" className="h-3.5 w-3.5" />
        Je confirme ce changement
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-gold px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-brand-gold-light disabled:opacity-60"
      >
        {pending ? "…" : "Mettre à jour le paiement"}
      </button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      <p className="w-full text-[11px] text-ink/50">
        Un client ne peut jamais se déclarer « payé » lui-même — ce choix est
        réservé à l&rsquo;admin, après vérification (livraison ou WhatsApp).
      </p>
    </form>
  );
}

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Supprimer définitivement la commande ${orderId} ? Cette action est irréversible.`
          )
        ) {
          startTransition(() => {
            deleteOrderAction(orderId);
          });
        }
      }}
      className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" /> Supprimer la commande
    </button>
  );
}

export function MarkTestButton({
  orderId,
  isTest,
}: {
  orderId: string;
  isTest: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setOrderTestAction(orderId, !isTest))}
      className="rounded-full border border-ink/15 px-4 py-2 text-xs font-bold text-ink/60 hover:bg-ivory disabled:opacity-60"
    >
      {isTest ? "Retirer le marquage « test »" : "Marquer comme commande test"}
    </button>
  );
}
