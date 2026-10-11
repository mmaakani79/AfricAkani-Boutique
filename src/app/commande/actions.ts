"use server";

import {
  createOrder,
  setOrderEmailError,
  setOrderStripeSession,
  setOrderPaypalOrderId,
  DuplicateTransactionIdError,
  type OrderDetail,
  type OrderInput,
} from "@/lib/orders-db";
import { getProductsByIds } from "@/lib/products-db";
import { getShippingSettings } from "@/lib/shipping-settings-db";
import { getOperator, isTransactionIdTaken } from "@/lib/mobile-money-db";
import { parseCart, parseOrderDraft, type OrderDraft, type ValidatedDraft } from "@/lib/order-draft";
import type { CartPreview } from "@/lib/price-change";
import {
  previewCart,
  priceOrder,
  stripeAmountMatchesQuote,
  stripeLineItems,
  summarizeQuote,
  type OrderQuote,
  type QuoteSummary,
} from "@/lib/order-pricing";
import { getSiteUrl } from "@/lib/order-config";
import { getStripeClient } from "@/lib/stripe";
import { createPaypalOrder, isPaypalConfigured } from "@/lib/paypal";
import {
  formatEmailError,
  sendAdminNewOrderNotification,
  sendCustomerOrderConfirmation,
} from "@/lib/email";

/** Money never comes from the browser. The draft carries choices only
 *  (products, variants, quantities, zone, customer details); every amount —
 *  unit prices, line totals, subtotal, shipping, total — is computed here from
 *  the database, and is what gets stored, charged by Stripe and PayPal, and
 *  shown back to the customer (`order` in each result). */
async function priceDraft(
  draft: ValidatedDraft
): Promise<{ ok: true; quote: OrderQuote } | { ok: false; error: string }> {
  const products = await getProductsByIds(draft.lines.map((l) => l.productId));
  const shipping = await getShippingSettings(draft.zoneId);
  return priceOrder({ zoneId: draft.zoneId, lines: draft.lines, products, shipping });
}

export type CartPreviewResult = { ok: true; preview: CartPreview } | { ok: false; error: string };

/** What this cart would cost right now, per line, as the server computes it.
 *  Creates nothing and charges nothing: the checkout page calls it before
 *  every payment to catch a price that changed since the customer added the
 *  product. Like the order itself, it takes only ids, quantities and the zone. */
export async function previewCartPricesAction(
  draft: Pick<OrderDraft, "zoneId" | "currency" | "items">
): Promise<CartPreviewResult> {
  const cart = parseCart(draft);
  if (!cart.ok) return cart;
  const products = await getProductsByIds(cart.lines.map((l) => l.productId));
  const shipping = await getShippingSettings(cart.zoneId);
  return {
    ok: true,
    preview: previewCart({ zoneId: cart.zoneId, lines: cart.lines, products, shipping }),
  };
}

function toOrderInput(
  draft: ValidatedDraft,
  quote: OrderQuote,
  extra: Pick<
    OrderInput,
    "paymentMethod" | "paymentStatus" | "mobileMoneyOperator" | "mobileMoneyPhone" | "mobileMoneyTransactionId"
  >
): OrderInput {
  return {
    id: draft.id,
    zoneId: quote.zoneId,
    subtotal: quote.subtotal,
    shippingFee: quote.shippingFee,
    freeShippingReached: quote.freeShippingReached,
    items: quote.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      variantId: line.variantId,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
    customer: draft.customer,
    ...extra,
  };
}

export interface OrderSubmissionResult {
  ok: boolean;
  error?: string;
  shippingFee?: number;
  /** The amounts the server computed — what the customer is actually charged. */
  order?: QuoteSummary;
}

function buildOrderDetail(input: OrderInput): OrderDetail {
  return {
    id: input.id,
    createdAt: new Date().toISOString(),
    zoneId: input.zoneId,
    subtotal: input.subtotal,
    shippingFee: input.shippingFee,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    customerEmail: input.customer.email,
    customerAddress: input.customer.address,
    customerCity: input.customer.city,
    customerApartment: input.customer.apartment ?? null,
    customerProvince: input.customer.province ?? null,
    customerPostalCode: input.customer.postalCode ?? null,
    customerCountry: input.customer.country ?? null,
    freeShippingReached: input.freeShippingReached,
    status: "nouvelle",
    paymentStatus: input.paymentStatus ?? "en_attente",
    paymentMethod: input.paymentMethod ?? null,
    isTest: false,
    reminder24hSentAt: null,
    reminder48hSentAt: null,
    emailError: null,
    mobileMoneyOperator: input.mobileMoneyOperator ?? null,
    mobileMoneyPhone: input.mobileMoneyPhone ?? null,
    mobileMoneyTransactionId: input.mobileMoneyTransactionId ?? null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paypalOrderId: null,
    paypalCaptureId: null,
    items: input.items.map((i) => ({
      productId: i.productId,
      productName: i.name,
      productSku: i.sku ?? null,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    reminders: [],
  };
}

// Notification emails are best-effort: the order itself is already saved,
// so a Resend hiccup (or no RESEND_API_KEY configured yet) must never block
// the customer's checkout flow. Failures are logged and surfaced on the
// order's admin page instead of being silently swallowed.
async function sendOrderReceivedNotifications(orderDetail: OrderDetail): Promise<void> {
  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminNewOrderNotification(orderDetail),
    sendCustomerOrderConfirmation(orderDetail),
  ]);

  const failures: string[] = [];
  if (adminResult.status === "rejected") {
    failures.push(`notification admin : ${formatEmailError(adminResult.reason)}`);
  }
  if (customerResult.status === "rejected") {
    failures.push(`confirmation client : ${formatEmailError(customerResult.reason)}`);
  }

  if (failures.length > 0) {
    const message = failures.join(" | ");
    console.error(`[email] Commande ${orderDetail.id} : e-mail(s) non envoyé(s) — ${message}`);
    await setOrderEmailError(orderDetail.id, message);
  } else {
    await setOrderEmailError(orderDetail.id, null);
  }
}

export async function submitOrderAction(
  draft: OrderDraft
): Promise<OrderSubmissionResult> {
  const parsed = parseOrderDraft(draft);
  if (!parsed.ok) return parsed;
  const validated = parsed.draft;
  const priced = await priceDraft(validated);
  if (!priced.ok) return priced;
  const { quote } = priced;

  let paymentMethod: OrderInput["paymentMethod"] = null;
  let paymentStatus: OrderInput["paymentStatus"] = "en_attente";
  // Freeze the operator's display name at order time (not its id/slug) —
  // historically accurate even if the operator is later renamed or removed.
  let mobileMoneyOperatorName: string | null = null;
  let mobileMoneyPhone: string | null = null;
  let mobileMoneyTransactionId: string | null = null;

  if (validated.wantsMobileMoney) {
    // Mobile Money is paid in FCFA: refuse it for a zone priced in another currency.
    if (quote.currency !== "FCFA") {
      return {
        ok: false,
        error: "Le paiement Mobile Money n'est disponible que pour la zone en FCFA.",
      };
    }

    const transactionId = validated.mobileMoneyTransactionId?.trim();
    if (!validated.mobileMoneyOperator || !transactionId || !validated.mobileMoneyPhone) {
      return { ok: false, error: "Merci de compléter les informations Mobile Money." };
    }

    const operator = await getOperator(validated.mobileMoneyOperator);
    if (!operator || !operator.active) {
      return { ok: false, error: "Opérateur Mobile Money invalide." };
    }

    if (await isTransactionIdTaken(transactionId)) {
      return {
        ok: false,
        error:
          "Cet identifiant de transaction a déjà été utilisé pour une autre commande. Vérifiez le SMS reçu ou contactez-nous.",
      };
    }

    paymentMethod = "mobile_money";
    paymentStatus = "en_verification";
    mobileMoneyOperatorName = operator.name;
    mobileMoneyPhone = validated.mobileMoneyPhone;
    mobileMoneyTransactionId = validated.mobileMoneyTransactionId;
  }

  const input = toOrderInput(validated, quote, {
    paymentMethod,
    paymentStatus,
    mobileMoneyOperator: mobileMoneyOperatorName,
    mobileMoneyPhone,
    mobileMoneyTransactionId,
  });

  try {
    await createOrder(input);
  } catch (err) {
    if (err instanceof DuplicateTransactionIdError) {
      return {
        ok: false,
        error:
          "Cet identifiant de transaction a déjà été utilisé pour une autre commande. Vérifiez le SMS reçu ou contactez-nous.",
      };
    }
    throw err;
  }

  await sendOrderReceivedNotifications(buildOrderDetail(input));

  return { ok: true, shippingFee: quote.shippingFee, order: summarizeQuote(quote) };
}

export interface StripeCheckoutResult {
  ok: boolean;
  error?: string;
  url?: string;
  shippingFee?: number;
  order?: QuoteSummary;
}

/** Card payment via a Stripe-hosted Checkout page — Canada/US zones only
 *  (Stripe handles CAD/USD natively; Bénin keeps Mobile Money + WhatsApp). */
export async function createStripeCheckoutAction(
  draft: OrderDraft
): Promise<StripeCheckoutResult> {
  const parsed = parseOrderDraft(draft);
  if (!parsed.ok) return parsed;
  const validated = parsed.draft;
  if (validated.zoneId !== "ca" && validated.zoneId !== "us") {
    return { ok: false, error: "Le paiement par carte n'est pas disponible pour cette zone." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { ok: false, error: "Le paiement par carte n'est pas configuré pour le moment." };
  }

  const priced = await priceDraft(validated);
  if (!priced.ok) return priced;
  const { quote } = priced;

  // What Stripe will charge must be exactly the total stored on the order.
  if (!stripeAmountMatchesQuote(quote)) {
    console.error(`[stripe] Commande ${validated.id} : montant Stripe ≠ total calculé, commande refusée.`);
    return { ok: false, error: "Erreur de calcul du montant. Aucune commande n'a été créée." };
  }

  const input = toOrderInput(validated, quote, {
    paymentMethod: "stripe",
    paymentStatus: "en_attente",
  });

  try {
    await createOrder(input);
  } catch (err) {
    console.error(`[stripe] Commande ${input.id} : échec de création en base.`, err);
    return { ok: false, error: "Erreur lors de la création de la commande." };
  }

  await sendOrderReceivedNotifications(buildOrderDetail(input));

  const siteUrl = getSiteUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Explicit rather than relying on the Stripe account's "automatic
      // payment methods" dashboard setting — that setting being off is a
      // common cause of session creation failing outright in production.
      payment_method_types: ["card"],
      line_items: stripeLineItems(quote),
      customer_email: input.customer.email || undefined,
      success_url: `${siteUrl}/commande/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/commande`,
      metadata: { orderId: input.id },
      payment_intent_data: { metadata: { orderId: input.id } },
    });

    if (!session.url) {
      console.error(`[stripe] Commande ${input.id} : session créée sans URL.`, session.id);
      return { ok: false, error: "Erreur lors de la création de la session de paiement." };
    }

    await setOrderStripeSession(input.id, session.id);

    return { ok: true, url: session.url, shippingFee: quote.shippingFee, order: summarizeQuote(quote) };
  } catch (err) {
    // Logged (not surfaced to the customer) so the real cause is visible in
    // the server logs — the generic Stripe SDK error otherwise gives no clue
    // why session creation actually failed.
    console.error(`[stripe] Commande ${input.id} : échec de création de la session Stripe.`, err);
    return { ok: false, error: "Erreur lors de la connexion à Stripe. Réessayez." };
  }
}

export interface PaypalCheckoutResult {
  ok: boolean;
  error?: string;
  url?: string;
  shippingFee?: number;
  order?: QuoteSummary;
}

/** PayPal Checkout — Canada/US zones only, alongside Stripe (Bénin keeps
 *  Mobile Money + WhatsApp). Creates the order, then redirects the customer
 *  to PayPal's hosted approval page; the actual capture happens when they
 *  return to /commande/succes. */
export async function createPaypalOrderAction(
  draft: OrderDraft
): Promise<PaypalCheckoutResult> {
  const parsed = parseOrderDraft(draft);
  if (!parsed.ok) return parsed;
  const validated = parsed.draft;
  if (validated.zoneId !== "ca" && validated.zoneId !== "us") {
    return { ok: false, error: "PayPal n'est pas disponible pour cette zone." };
  }

  if (!isPaypalConfigured()) {
    return { ok: false, error: "PayPal n'est pas configuré pour le moment." };
  }

  const priced = await priceDraft(validated);
  if (!priced.ok) return priced;
  const { quote } = priced;

  const input = toOrderInput(validated, quote, {
    paymentMethod: "paypal",
    paymentStatus: "en_attente",
  });

  try {
    await createOrder(input);
  } catch (err) {
    console.error(`[paypal] Commande ${input.id} : échec de création en base.`, err);
    return { ok: false, error: "Erreur lors de la création de la commande." };
  }

  await sendOrderReceivedNotifications(buildOrderDetail(input));

  const siteUrl = getSiteUrl();

  try {
    const order = await createPaypalOrder({
      orderId: input.id,
      currency: quote.currency,
      // The same total that was just stored on the order, never a browser value.
      amount: quote.total,
      returnUrl: `${siteUrl}/commande/succes?order_id=${input.id}`,
      cancelUrl: `${siteUrl}/commande`,
    });

    await setOrderPaypalOrderId(input.id, order.id);

    return { ok: true, url: order.approveUrl, shippingFee: quote.shippingFee, order: summarizeQuote(quote) };
  } catch (err) {
    console.error(`[paypal] Commande ${input.id} : échec de création de la commande PayPal.`, err);
    return { ok: false, error: "Erreur lors de la connexion à PayPal. Réessayez." };
  }
}
