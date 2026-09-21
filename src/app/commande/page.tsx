"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Truck } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useZone } from "@/context/zone-context";
import { ZONES } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import { saveOrder, type Order } from "@/lib/orders";
import { submitOrderAction } from "./actions";
import { Container } from "@/components/layout/container";
import { getPaymentTimeoutHours } from "@/lib/order-config";

const PAYMENT_TIMEOUT_HOURS = getPaymentTimeoutHours();

export default function CommandePage() {
  const { items, subtotal, clearCart } = useCart();
  const { zoneId, zone, setZoneId, format } = useZone();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const remaining = Math.max(zone.freeShippingThreshold - subtotal, 0);
  const reached = remaining === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const order: Order = {
      id: `AK-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      zoneId,
      subtotal,
      freeShippingReached: reached,
      items: items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        sku: i.product.sku ?? null,
        quantity: i.quantity,
        unitPrice: i.lineTotal / i.quantity,
        lineTotal: i.lineTotal,
      })),
      customer: { name, email, phone, address, city },
    };

    try {
      await submitOrderAction(order);
    } catch {
      // The order still succeeds for the customer even if the admin-facing
      // database write fails (e.g. no database configured yet).
    }

    saveOrder(order);
    clearCart();
    setConfirmedOrder(order);
  }

  if (confirmedOrder) {
    return (
      <Container className="py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-brand-green" />
          <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
            Merci, {confirmedOrder.customer.name.split(" ")[0] || "votre commande est confirmée"} !
          </h1>
          <p className="text-sm text-ink/60">
            Votre commande <span className="font-semibold">{confirmedOrder.id}</span> a
            bien été enregistrée. Vous la retrouverez dans votre espace « Mon
            compte ».
          </p>
          <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
            Merci de confirmer votre paiement (à la livraison ou par WhatsApp)
            dans les {PAYMENT_TIMEOUT_HOURS} heures, sans quoi la commande
            sera automatiquement annulée.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/compte"
              className="rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
            >
              Voir mes commandes
            </Link>
            <Link
              href="/catalogue"
              className="rounded-full border border-brand-green px-6 py-3 text-sm font-bold text-brand-green hover:bg-white"
            >
              Continuer mes achats
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm text-ink/60">
            Votre panier est vide.{" "}
            <Link href="/catalogue" className="font-semibold text-brand-green">
              Retourner au catalogue
            </Link>
            .
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <h1 className="font-brand text-3xl font-bold text-brand-green-dark">
        Finaliser la commande
      </h1>

      <div className="mt-8 grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-5">
          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-gold">
              Zone de livraison
            </label>
            <div className="flex gap-2">
              {(Object.keys(ZONES) as ZoneId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setZoneId(id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                    zoneId === id
                      ? "border-brand-green bg-brand-green text-ivory"
                      : "border-brand-green/20 text-brand-green-dark"
                  }`}
                >
                  {ZONES[id].shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" value={name} onChange={setName} required />
            <Field
              label="Téléphone"
              value={phone}
              onChange={setPhone}
              required
              type="tel"
            />
          </div>
          <Field
            label="Adresse e-mail"
            value={email}
            onChange={setEmail}
            required
            type="email"
          />
          <Field label="Adresse de livraison" value={address} onChange={setAddress} required />
          <Field label="Ville" value={city} onChange={setCity} required />

          <p className="text-xs text-ink/50">
            Paiement à la livraison ou par WhatsApp — merci de confirmer dans
            les {PAYMENT_TIMEOUT_HOURS} heures suivant la commande, sans quoi
            elle sera automatiquement annulée.
          </p>

          <button
            type="submit"
            className="w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
          >
            Confirmer la commande
          </button>
        </form>

        <div className="h-fit space-y-4 rounded-2xl bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
            Récapitulatif
          </h2>
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.product.id} className="flex justify-between gap-2">
                <span className="text-ink/70">
                  {item.quantity} × {item.product.name}
                </span>
                <span className="shrink-0 font-semibold">
                  {format(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-brand-green/10 pt-3 flex justify-between text-base font-bold text-brand-green-dark">
            <span>Sous-total</span>
            <span>{format(subtotal)}</span>
          </div>

          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-xs font-semibold ${
              reached
                ? "bg-brand-green/10 text-brand-green-dark"
                : "bg-brand-gold/10 text-brand-green-dark"
            }`}
          >
            <Truck className="mt-0.5 h-4 w-4 shrink-0" />
            {reached ? (
              <span>Livraison gratuite débloquée pour cette commande.</span>
            ) : (
              <span>
                Il vous manque {format(remaining)} pour bénéficier de la
                livraison gratuite ({zone.label}).
              </span>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      />
    </label>
  );
}
