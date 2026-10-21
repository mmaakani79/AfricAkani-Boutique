"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Truck } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useZone } from "@/context/zone-context";
import { ZONES, formatPrice } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import type { MobileMoneyConfig } from "@/lib/mobile-money-types";
import { saveOrder, type Order } from "@/lib/orders";
import {
  createStripeCheckoutAction,
  createPaypalOrderAction,
  previewCartPricesAction,
  submitOrderAction,
} from "./actions";
import { PriceChangePanel } from "./price-change-panel";
import type { OrderDraft } from "@/lib/order-draft";
import { withTimeout } from "@/lib/with-timeout";
import type { QuoteSummary } from "@/lib/order-pricing";
import {
  detectPriceChange,
  type DisplayedPrices,
  type PriceChangeLine,
  type PriceChangeReport,
} from "@/lib/price-change";
import { MobileMoneyPanel } from "./mobile-money-panel";
import {
  PaymentBadgeRow,
  MobileMoneyBadgeRow,
  PaypalButton,
} from "@/components/shop/payment-brand-icons";
import { Container } from "@/components/layout/container";
import { getPaymentTimeoutHours } from "@/lib/order-config";
import { computeShippingFee, isBelowMinOrder } from "@/lib/shipping-calc";
import { countriesForZone } from "@/lib/zone-countries";
import { CartZoneNotice } from "@/components/shop/cart-zone-notice";

const PAYMENT_TIMEOUT_HOURS = getPaymentTimeoutHours();

// How long the page waits for the server before telling the customer the order
// was not recorded. A late answer is harmless: a retry reuses the same order
// number, so it finds the order instead of creating a second one.
const ORDER_SUBMIT_TIMEOUT_MS = 25_000;
const PRICE_CHECK_TIMEOUT_MS = 12_000;

const ORDER_NOT_SAVED_MESSAGE =
  "Votre commande n'a pas été enregistrée : vérifiez votre connexion et réessayez. Votre panier et vos informations sont conservés, et un nouvel essai ne crée jamais de commande en double.";

export default function CommandePage() {
  const { items, subtotal, clearCart, removeItem, refreshProducts } = useCart();
  const { zoneId, zone, setZoneId, format, applyShippingSettings } = useZone();

  const [orderId] = useState(
    () => `AK-${Date.now().toString(36).toUpperCase()}`
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // True when the order could not be recorded (no network, too slow, server
  // error): the error then comes with a "Réessayer" button.
  const [canRetry, setCanRetry] = useState(false);
  // Synchronous guard against a double click (state updates are asynchronous).
  const submittingRef = useRef(false);
  // "Le prix a changé": set when the server's current prices differ from the
  // ones displayed. While it is open nothing has been created or charged.
  const [priceChange, setPriceChange] = useState<PriceChangeReport | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const priceChangeRef = useRef<HTMLDivElement>(null);

  const [mmConfig, setMmConfig] = useState<MobileMoneyConfig | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<
    "whatsapp" | "mobile_money" | "stripe" | "paypal"
  >("whatsapp");
  const [mmOperatorId, setMmOperatorId] = useState("");
  const [mmPhone, setMmPhone] = useState("");
  const [mmTransactionId, setMmTransactionId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mobile-money-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MobileMoneyConfig | null) => {
        if (!data || cancelled) return;
        setMmConfig(data);
        if (data.operators.length > 0) {
          setMmOperatorId((current) => current || data.operators[0].id);
        }
      })
      .catch(() => {
        /* Mobile Money option simply won't be offered */
      });
    fetch("/api/stripe-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured: boolean } | null) => {
        if (!cancelled && data) setStripeConfigured(data.configured);
      })
      .catch(() => {
        /* Card payment option simply won't be offered */
      });
    fetch("/api/paypal-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured: boolean } | null) => {
        if (!cancelled && data) setPaypalConfigured(data.configured);
      })
      .catch(() => {
        /* PayPal option simply won't be offered */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Another zone means other prices: any open price-change panel is obsolete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPriceChange(null);
    setPriceNotice(null);
  }, [zoneId]);

  useEffect(() => {
    if (priceChange) priceChangeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [priceChange]);

  const isNorthAmerica = zoneId === "ca" || zoneId === "us";

  // The delivery country can only be one of the chosen zone's countries; when the
  // zone changes, the choice falls back to the zone's first country. (The server
  // checks it again: this list is only a convenience.)
  const zoneCountries = countriesForZone(zoneId);
  const deliveryCountry = zoneCountries.some((c) => c.name === country)
    ? country
    : zoneCountries[0].name;

  const mobileMoneyAvailable =
    zoneId === "bj" && (mmConfig?.operators.length ?? 0) > 0;
  const stripeAvailable = isNorthAmerica && stripeConfigured;
  const paypalAvailable = isNorthAmerica && paypalConfigured;

  const remaining = Math.max(zone.freeShippingThreshold - subtotal, 0);
  const reached = remaining === 0;
  const shippingFee = computeShippingFee(subtotal, zone);
  const total = subtotal + shippingFee;
  const belowMinOrder = isBelowMinOrder(subtotal, zone);
  const usingMobileMoney = mobileMoneyAvailable && paymentChoice === "mobile_money";
  const usingStripe = stripeAvailable && paymentChoice === "stripe";
  const usingPaypal = paypalAvailable && paymentChoice === "paypal";
  const mobileMoneyIncomplete =
    usingMobileMoney &&
    (!mmOperatorId || !mmPhone.trim() || !mmTransactionId.trim());

  type CartItems = typeof items;

  function lineName(i: CartItems[number]): string {
    const variantLabel = i.variant
      ? Object.entries(i.variant.attributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : null;
    return variantLabel ? `${i.product.name} (${variantLabel})` : i.product.name;
  }

  /** The prices on screen for these lines, as the customer sees them. */
  function displayedPrices(list: CartItems): DisplayedPrices {
    const sub = list.reduce((sum, i) => sum + i.lineTotal, 0);
    const fee = computeShippingFee(sub, zone);
    return {
      zoneId,
      items: list.map((i) => ({
        productId: i.product.id,
        variantId: i.variant?.id ?? null,
        name: lineName(i),
        unitPrice: i.lineTotal / i.quantity,
      })),
      shippingFee: fee,
      total: sub + fee,
    };
  }

  /** Asks the server what this cart costs right now and compares it with what
   *  is displayed. "unknown" = the server could not be reached or refused the
   *  cart: the order call that follows reports that exactly as before. */
  async function checkPrices(
    list: CartItems
  ): Promise<
    { status: "changed"; report: PriceChangeReport } | { status: "same" } | { status: "unknown" }
  > {
    try {
      const res = await withTimeout(
        previewCartPricesAction({
          zoneId,
          currency: zone.currency,
          items: list.map((i) => ({
            productId: i.product.id,
            variantId: i.variant?.id ?? null,
            quantity: i.quantity,
          })),
        }),
        PRICE_CHECK_TIMEOUT_MS
      );
      if (!res.ok) return { status: "unknown" };
      const report = detectPriceChange(displayedPrices(list), res.preview);
      return report ? { status: "changed", report } : { status: "same" };
    } catch {
      return { status: "unknown" };
    }
  }

  function continueAtNewPrice() {
    if (!priceChange || priceChange.hasUnavailable) return;
    refreshProducts(priceChange.products);
    applyShippingSettings(priceChange.shipping);
    setPriceChange(null);
    setPriceNotice(
      `Les prix ont été mis à jour. Vérifiez le nouveau total, puis cliquez sur « ${submitLabel} » pour confirmer.`
    );
  }

  async function removeLine(line: PriceChangeLine) {
    removeItem(line.productId, line.variantId ?? undefined);
    const remaining = items.filter(
      (i) => !(i.product.id === line.productId && (i.variant?.id ?? null) === line.variantId)
    );
    setPriceChange(null);
    setPriceNotice(null);
    if (remaining.length === 0) return;
    setRechecking(true);
    const result = await checkPrices(remaining);
    setRechecking(false);
    if (result.status === "changed") setPriceChange(result.report);
    else if (result.status === "unknown") {
      setPriceNotice(
        "Produit retiré. Les prix n'ont pas pu être revérifiés (connexion indisponible) : ils seront contrôlés au moment du paiement."
      );
    }
  }

  // Only used for the local "Mon compte" copy when the server could not be
  // reached at all; whenever the server answers, its own figures are used.
  function estimateFromCart(): QuoteSummary {
    return {
      subtotal,
      shippingFee,
      total,
      freeShippingReached: reached,
      items: items.map((i) => ({
        productId: i.product.id,
        variantId: i.variant?.id ?? null,
        name: lineName(i),
        quantity: i.quantity,
        unitPrice: i.lineTotal / i.quantity,
        lineTotal: i.lineTotal,
      })),
    };
  }

  const submitLabel = usingStripe
    ? "Payer par carte"
    : usingPaypal
      ? "Payer avec PayPal"
      : "Confirmer la commande";

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submitOrder();
    } finally {
      submittingRef.current = false;
    }
  }

  async function submitOrder() {
    setSubmitError(null);
    setCanRetry(false);
    setPriceNotice(null);
    setSubmitting(true);

    // Before anything is created or charged: is what the customer sees still
    // what the server would charge? If not, show what changed and stop here.
    const priceCheck = await checkPrices(items);
    if (priceCheck.status === "changed") {
      setSubmitting(false);
      setPriceChange(priceCheck.report);
      return;
    }
    setPriceChange(null);

    // Choices only — never an amount. The server prices the order itself
    // (prices, shipping, total) and sends its figures back in `result.order`.
    const draft: OrderDraft = {
      id: orderId,
      zoneId,
      currency: zone.currency,
      items: items.map((i) => ({
        productId: i.product.id,
        variantId: i.variant?.id ?? null,
        quantity: i.quantity,
      })),
      customer: {
        name,
        email,
        phone,
        address,
        city,
        country: deliveryCountry,
        ...(isNorthAmerica
          ? {
              apartment: apartment.trim() || null,
              province: province.trim() || null,
              postalCode: postalCode.trim() || null,
            }
          : {}),
      },
      ...(usingMobileMoney
        ? {
            paymentMethod: "mobile_money",
            mobileMoneyOperator: mmOperatorId,
            mobileMoneyPhone: mmPhone.trim(),
            mobileMoneyTransactionId: mmTransactionId.trim(),
          }
        : {}),
      ...(usingStripe ? { paymentMethod: "stripe" } : {}),
      ...(usingPaypal ? { paymentMethod: "paypal" } : {}),
    };

    if (usingStripe || usingPaypal) {
      let redirectResult;
      try {
        redirectResult = usingStripe
          ? await createStripeCheckoutAction(draft)
          : await createPaypalOrderAction(draft);
      } catch {
        setSubmitting(false);
        setSubmitError("Une erreur est survenue. Merci de réessayer.");
        return;
      }

      setSubmitting(false);

      if (!redirectResult.ok || !redirectResult.url) {
        setSubmitError(redirectResult.error ?? "Une erreur est survenue. Merci de réessayer.");
        return;
      }

      const charged = redirectResult.order ?? estimateFromCart();
      saveOrder({
        id: draft.id,
        createdAt: new Date().toISOString(),
        zoneId,
        subtotal: charged.subtotal,
        shippingFee: charged.shippingFee,
        freeShippingReached: charged.freeShippingReached,
        items: charged.items,
        customer: draft.customer,
        paymentMethod: usingStripe ? "stripe" : "paypal",
        mobileMoneyOperator: null,
        mobileMoneyTransactionId: null,
      });
      clearCart();
      window.location.assign(redirectResult.url);
      return;
    }

    // WhatsApp and Mobile Money: the customer is shown a confirmation only once
    // the server says the order is recorded. Any failure — no network, no answer
    // in time, a server error — leaves the cart and the form as they are.
    let result;
    try {
      result = await withTimeout(submitOrderAction(draft), ORDER_SUBMIT_TIMEOUT_MS);
    } catch {
      setSubmitting(false);
      setSubmitError(ORDER_NOT_SAVED_MESSAGE);
      setCanRetry(true);
      return;
    }

    setSubmitting(false);

    if (!result.ok || !result.order) {
      setSubmitError(result.error ?? ORDER_NOT_SAVED_MESSAGE);
      setCanRetry(!result.error);
      return;
    }

    const charged = result.order;
    const order: Order = {
      id: draft.id,
      createdAt: new Date().toISOString(),
      zoneId,
      subtotal: charged.subtotal,
      shippingFee: charged.shippingFee,
      freeShippingReached: charged.freeShippingReached,
      items: charged.items,
      customer: draft.customer,
      paymentMethod: draft.paymentMethod ?? null,
      mobileMoneyOperator: usingMobileMoney
        ? (mmConfig?.operators.find((op) => op.id === mmOperatorId)?.name ?? mmOperatorId)
        : null,
      mobileMoneyTransactionId: draft.mobileMoneyTransactionId ?? null,
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
          {confirmedOrder.paymentMethod === "mobile_money" ? (
            <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
              Votre paiement Mobile Money ({confirmedOrder.mobileMoneyOperator}
              {" — "}transaction {confirmedOrder.mobileMoneyTransactionId}) est
              en cours de vérification. Nous confirmons votre paiement sous 30
              minutes en général, et au plus tard sous 2 heures — vous
              recevrez un e-mail dès qu&rsquo;il sera confirmé.
            </p>
          ) : (
            <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
              Nous vous contacterons par WhatsApp pour finaliser le paiement.
              Merci de confirmer dans les {PAYMENT_TIMEOUT_HOURS} heures, sans
              quoi la commande sera automatiquement annulée.
            </p>
          )}
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
          <Link
            href={`/suivi?commande=${confirmedOrder.id}`}
            className="text-xs font-semibold text-brand-green-dark underline-offset-2 hover:underline"
          >
            Suivre ma commande
          </Link>
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-xl">
          <CartZoneNotice />
        </div>
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
      <CartZoneNotice />
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

          {isNorthAmerica ? (
            <>
              <Field
                label="Numéro et rue"
                value={address}
                onChange={setAddress}
                required
              />
              <Field
                label="Appartement, suite, etc. (optionnel)"
                value={apartment}
                onChange={setApartment}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ville" value={city} onChange={setCity} required />
                <Field
                  label="Province / État"
                  value={province}
                  onChange={setProvince}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Code postal"
                  value={postalCode}
                  onChange={setPostalCode}
                  required
                />
                <SelectField
                  label="Pays"
                  value={deliveryCountry}
                  onChange={setCountry}
                  options={zoneCountries.map((c) => c.name)}
                />
              </div>
            </>
          ) : (
            <>
              <Field label="Adresse de livraison" value={address} onChange={setAddress} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ville" value={city} onChange={setCity} required />
                <SelectField
                  label="Pays"
                  value={deliveryCountry}
                  onChange={setCountry}
                  options={zoneCountries.map((c) => c.name)}
                />
              </div>
            </>
          )}

          {(mobileMoneyAvailable || stripeAvailable || paypalAvailable) && (
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-gold">
                Mode de paiement
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentChoice("whatsapp")}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                    paymentChoice === "whatsapp"
                      ? "border-brand-green bg-brand-green text-ivory"
                      : "border-brand-green/20 text-brand-green-dark"
                  }`}
                >
                  WhatsApp
                </button>
                {mobileMoneyAvailable && (
                  <button
                    type="button"
                    onClick={() => setPaymentChoice("mobile_money")}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                      paymentChoice === "mobile_money"
                        ? "border-brand-green bg-brand-green text-ivory"
                        : "border-brand-green/20 text-brand-green-dark"
                    }`}
                  >
                    Mobile Money
                  </button>
                )}
                {mobileMoneyAvailable && <MobileMoneyBadgeRow />}
                {stripeAvailable && (
                  <button
                    type="button"
                    onClick={() => setPaymentChoice("stripe")}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                      paymentChoice === "stripe"
                        ? "border-brand-green bg-brand-green text-ivory"
                        : "border-brand-green/20 text-brand-green-dark"
                    }`}
                  >
                    Payer par carte
                  </button>
                )}
                {stripeAvailable && <PaymentBadgeRow />}
              </div>
            </div>
          )}

          {paypalAvailable && (
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-gold">
                Ou payez avec PayPal
              </label>
              <PaypalButton
                selected={paymentChoice === "paypal"}
                onClick={() => setPaymentChoice("paypal")}
              />
            </div>
          )}

          {usingMobileMoney && mmConfig && (
            <MobileMoneyPanel
              config={mmConfig}
              orderId={orderId}
              amount={total}
              format={format}
              operatorId={mmOperatorId}
              onOperatorChange={setMmOperatorId}
              phone={mmPhone}
              onPhoneChange={setMmPhone}
              transactionId={mmTransactionId}
              onTransactionIdChange={setMmTransactionId}
            />
          )}

          {usingStripe && (
            <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-sm font-medium text-ink/80">
              Vous allez être redirigé(e) vers une page de paiement sécurisée
              Stripe pour régler {format(total)} par carte.
            </p>
          )}

          {usingPaypal && (
            <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-sm font-medium text-ink/80">
              Vous allez être redirigé(e) vers PayPal pour régler {format(total)}
              , par votre compte PayPal ou par carte.
            </p>
          )}

          {!usingMobileMoney && !usingStripe && !usingPaypal && (
            <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-sm font-medium text-ink/80">
              Nous vous contacterons par WhatsApp pour finaliser le paiement —
              merci de confirmer dans les {PAYMENT_TIMEOUT_HOURS} heures suivant
              la commande, sans quoi elle sera automatiquement annulée.
            </p>
          )}

          {belowMinOrder && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              Montant minimum de commande pour {zone.label} :{" "}
              {format(zone.minOrderAmount ?? 0)}. Ajoutez des articles pour
              continuer.
            </p>
          )}
          {priceChange && (
            <div ref={priceChangeRef}>
              <PriceChangePanel
                report={priceChange}
                format={format}
                busy={rechecking}
                onContinue={continueAtNewPrice}
                onRemove={removeLine}
              />
            </div>
          )}
          {priceNotice && (
            <p
              role="status"
              data-testid="price-notice"
              className="rounded-xl bg-brand-green/10 px-4 py-3 text-xs font-semibold text-brand-green-dark"
            >
              {priceNotice}
            </p>
          )}
          {submitError && (
            <p
              role="alert"
              data-testid="submit-error"
              className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"
            >
              {submitError}
            </p>
          )}
          {submitError && canRetry && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit()}
              data-testid="retry-order"
              className="w-full rounded-full border-2 border-brand-green py-2.5 text-sm font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-50"
            >
              Réessayer
            </button>
          )}

          <button
            type="submit"
            disabled={belowMinOrder || submitting || mobileMoneyIncomplete}
            className="w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Envoi…" : submitLabel}
          </button>
          {/* Plain links that open in a new tab: the form (and its payment
              buttons) is untouched and nothing typed is lost. */}
          <p data-testid="order-legal-links" className="text-center text-xs text-ink/60">
            En passant commande, vous acceptez nos{" "}
            <a
              href="/conditions-de-vente"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-green-dark underline underline-offset-2"
            >
              Conditions de vente
            </a>{" "}
            et notre{" "}
            <a
              href="/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-green-dark underline underline-offset-2"
            >
              Politique de confidentialité
            </a>
            .
          </p>
        </form>

        <div className="h-fit space-y-4 rounded-2xl bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
            Récapitulatif
          </h2>
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li
                key={`${item.product.id}::${item.variant?.id ?? ""}`}
                className="flex justify-between gap-2"
              >
                <span className="text-ink/70">
                  {item.quantity} × {item.product.name}
                  {item.variant && (
                    <span className="block text-xs text-ink/50">
                      {Object.entries(item.variant.attributes)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </span>
                  )}
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

          {zone.shippingFee > 0 && (
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
          )}
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label}
      </span>
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
