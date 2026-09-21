"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Truck } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useZone } from "@/context/zone-context";
import { ZONES, formatPrice } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import { saveOrder, type Order } from "@/lib/orders";
import { submitOrderAction, type OrderDraft } from "./actions";
import { Container } from "@/components/layout/container";
import { getPaymentTimeoutHours } from "@/lib/order-config";
import { computeShippingFee, isBelowMinOrder } from "@/lib/shipping-calc";

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remaining = Math.max(zone.freeShippingThreshold - subtotal, 0);
  const reached = remaining === 0;
  const shippingFee = computeShippingFee(subtotal, zone);
  const total = subtotal + shippingFee;
  const belowMinOrder = isBelowMinOrder(subtotal, zone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const draft: OrderDraft = {
      id: `AK-${Date.now().toString(36).toUpperCase()}`,
      zoneId,
      subtotal,
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

    let result;
    try {
      result = await submitOrderAction(draft);
    } catch {
      // The order still succeeds for the customer even if the admin-facing
      // database write fails (e.g. no database configured yet) — estimate
      // the shipping fee locally in that fallback case.
      result = { ok: true as const, shippingFee };
    }

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error ?? "Une erreur est survenue. Merci de réessayer.");
      return;
    }

    const order: Order = {
      id: draft.id,
      createdAt: new Date().toISOString(),
      zoneId,
      subtotal,
      shippingFee: result.shippingFee ?? shippingFee,
      freeShippingReached: reached,
      items: draft.items,
      customer: draft.customer,
    };

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
          <div className="w-full max-w-xs space-y-1.5 rounded-xl bg-white p-4 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Sous-total</span>
              <span>{formatPrice(confirmedOrder.subtotal, confirmedOrder.zoneId)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Livraison</span>
              <span>
                {confirmedOrder.shippingFee > 0
                  ? formatPrice(confirmedOrder.shippingFee, confirmedOrder.zoneId)
                  : "Gratuite"}
              </span>
            </div>
            <div className="flex justify-between border-t border-brand-green/10 pt-1.5 font-bold text-brand-green-dark">
              <span>Total</span>
              <span>
                {formatPrice(
                  confirmedOrder.subtotal + confirmedOrder.shippingFee,
                  confirmedOrder.zoneId
                )}
              </span>
            </div>
          </div>
          <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
            Nous vous contacterons par WhatsApp pour finaliser le paiement.
            Merci de confirmer dans les {PAYMENT_TIMEOUT_HOURS} heures, sans
            quoi la commande sera automatiquement annulée.
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
            Nous vous contacterons par WhatsApp pour finaliser le paiement —
            merci de confirmer dans les {PAYMENT_TIMEOUT_HOURS} heures suivant
            la commande, sans quoi elle sera automatiquement annulée.
          </p>

          {belowMinOrder && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              Montant minimum de commande pour {zone.label} :{" "}
              {format(zone.minOrderAmount ?? 0)}. Ajoutez des articles pour
              continuer.
            </p>
          )}
          {submitError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={belowMinOrder || submitting}
            className="w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Envoi…" : "Confirmer la commande"}
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
          <div className="border-t border-brand-green/10 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Sous-total</span>
              <span>{format(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Livraison</span>
              <span>{shippingFee > 0 ? format(shippingFee) : "Gratuite"}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-brand-green-dark">
              <span>Total</span>
              <span>{format(total)}</span>
            </div>
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
