"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, MapPin } from "lucide-react";
import { getOrders, type Order } from "@/lib/orders";
import { ZONES } from "@/data/zones";
import { formatPrice } from "@/data/zones";
import { Container } from "@/components/layout/container";
import { getOrderLiveStatusAction } from "@/app/suivi/actions";
import type { OrderStatus, PaymentStatus } from "@/lib/order-types";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-labels";

type LiveStatus = { status: OrderStatus; paymentStatus: PaymentStatus };

export default function ComptePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});

  useEffect(() => {
    // One-time hydration from localStorage on mount; SSR has no access to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrders(getOrders());
  }, []);

  useEffect(() => {
    if (orders.length === 0) return;
    let cancelled = false;
    Promise.all(
      orders.map((o) =>
        getOrderLiveStatusAction(o.id, o.customer.email || o.customer.phone)
          .then((result) => [o.id, result] as const)
          .catch(() => [o.id, null] as const)
      )
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, LiveStatus> = {};
      for (const [id, result] of results) {
        if (result) next[id] = result;
      }
      setLiveStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [orders]);

  const addresses = Array.from(
    new Map(
      orders.map((o) => [
        `${o.customer.address}, ${o.customer.city}`,
        o.customer,
      ])
    ).values()
  );

  return (
    <Container className="py-10">
      <h1 className="font-brand text-3xl font-bold text-brand-green-dark">
        Mon compte
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Historique de commandes et adresses enregistrées sur cet appareil.
      </p>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
          <Package className="h-4 w-4" /> Mes commandes
        </h2>

        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
            Vous n&rsquo;avez pas encore de commande.{" "}
            <Link href="/catalogue" className="font-semibold text-brand-green">
              Découvrir la boutique
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-brand-green-dark">
                    Commande {order.id}
                  </span>
                  <span className="text-xs text-ink/50">
                    {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {liveStatus[order.id] && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${PAYMENT_STATUS_COLORS[liveStatus[order.id].paymentStatus]}`}
                    >
                      {PAYMENT_STATUS_LABELS[liveStatus[order.id].paymentStatus]}
                    </span>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${ORDER_STATUS_COLORS[liveStatus[order.id].status]}`}
                    >
                      {ORDER_STATUS_LABELS[liveStatus[order.id].status]}
                    </span>
                  </div>
                )}
                <p className="mt-1 text-xs text-ink/50">
                  {ZONES[order.zoneId].label} —{" "}
                  {order.freeShippingReached
                    ? "livraison gratuite"
                    : "livraison standard"}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-ink/70">
                  {order.items.map((item) => (
                    <li key={item.productId} className="flex justify-between">
                      <span>
                        {item.quantity} × {item.name}
                      </span>
                      <span>{formatPrice(item.lineTotal, order.zoneId)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-brand-green/10 pt-2 text-sm">
                  <div className="flex justify-between text-ink/60">
                    <span>Sous-total</span>
                    <span>{formatPrice(order.subtotal, order.zoneId)}</span>
                  </div>
                  <div className="flex justify-between text-ink/60">
                    <span>Livraison</span>
                    <span>
                      {order.shippingFee > 0
                        ? formatPrice(order.shippingFee, order.zoneId)
                        : "Gratuite"}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-brand-green-dark">
                    <span>Total</span>
                    <span>
                      {formatPrice(order.subtotal + order.shippingFee, order.zoneId)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
          <MapPin className="h-4 w-4" /> Adresses enregistrées
        </h2>
        {addresses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
            Aucune adresse enregistrée pour le moment.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {addresses.map((c) => (
              <li
                key={`${c.address}-${c.city}`}
                className="rounded-2xl bg-white p-4 text-sm"
              >
                <p className="font-semibold text-brand-green-dark">
                  {c.name}
                </p>
                <p className="text-ink/60">
                  {c.address}, {c.city}
                </p>
                <p className="text-ink/60">
                  {c.phone} · {c.email}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
