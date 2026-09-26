"use server";

import {
  createOrder,
  setOrderEmailError,
  setOrderStripeSession,
  DuplicateTransactionIdError,
  type OrderDetail,
  type OrderInput,
} from "@/lib/orders-db";
import { getShippingSettings } from "@/lib/shipping-settings-db";
import { computeShippingFee, isBelowMinOrder } from "@/lib/shipping-calc";
import { getOperator, isTransactionIdTaken } from "@/lib/mobile-money-db";
import { roundForZone, formatPrice, ZONES } from "@/data/zones";
import { getSiteUrl } from "@/lib/order-config";
import { getStripeClient } from "@/lib/stripe";
import {
  formatEmailError,
  sendAdminNewOrderNotification,
  sendCustomerOrderConfirmation,
} from "@/lib/email";

export type OrderDraft = Omit<OrderInput, "shippingFee" | "freeShippingReached">;

export interface OrderSubmissionResult {
  ok: boolean;
  error?: string;
  shippingFee?: number;
}

async function computeOrderPricing(
  input: Pick<OrderDraft, "zoneId" | "subtotal">
): Promise<
  | { ok: true; shippingFee: number; freeShippingReached: boolean }
  | { ok: false; error: string }
> {
  const settings = await getShippingSettings(input.zoneId);

  if (isBelowMinOrder(input.subtotal, settings)) {
    return {
      ok: false,
      error: `Montant minimum de commande pour cette zone : ${formatPrice(
        settings.minOrderAmount!,
        input.zoneId
      )}.`,
    };
  }

  const shippingFee = roundForZone(
    computeShippingFee(input.subtotal, settings),
    input.zoneId
  );
  const freeShippingReached = input.subtotal >= settings.freeShippingThreshold;

  return { ok: true, shippingFee, freeShippingReached };
}

function buildOrderDetail(
  input: OrderDraft,
  extra: {
    shippingFee: number;
    freeShippingReached: boolean;
    paymentStatus: OrderInput["paymentStatus"];
    mobileMoneyOperatorName?: string | null;
  }
): OrderDetail {
  return {
    id: input.id,
    createdAt: new Date().toISOString(),
    zoneId: input.zoneId,
    subtotal: input.subtotal,
    shippingFee: extra.shippingFee,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    customerEmail: input.customer.email,
    customerAddress: input.customer.address,
    customerCity: input.customer.city,
    customerApartment: input.customer.apartment ?? null,
    customerProvince: input.customer.province ?? null,
    customerPostalCode: input.customer.postalCode ?? null,
    customerCountry: input.customer.country ?? null,
    freeShippingReached: extra.freeShippingReached,
    status: "nouvelle",
    paymentStatus: extra.paymentStatus ?? "en_attente",
    paymentMethod: input.paymentMethod ?? null,
    isTest: false,
    reminder24hSentAt: null,
    reminder48hSentAt: null,
    emailError: null,
    mobileMoneyOperator: extra.mobileMoneyOperatorName ?? null,
    mobileMoneyPhone: input.mobileMoneyPhone ?? null,
    mobileMoneyTransactionId: input.mobileMoneyTransactionId ?? null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
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
  input: OrderDraft
): Promise<OrderSubmissionResult> {
  const pricing = await computeOrderPricing(input);
  if (!pricing.ok) return pricing;
  const { shippingFee, freeShippingReached } = pricing;

  let paymentStatus: OrderInput["paymentStatus"] = "en_attente";
  // Freeze the operator's display name at order time (not its id/slug) —
  // historically accurate even if the operator is later renamed or removed.
  let mobileMoneyOperatorName: string | null = null;

  if (input.paymentMethod === "mobile_money") {
    const transactionId = input.mobileMoneyTransactionId?.trim();
    if (!input.mobileMoneyOperator || !transactionId || !input.mobileMoneyPhone) {
      return { ok: false, error: "Merci de compléter les informations Mobile Money." };
    }

    const operator = await getOperator(input.mobileMoneyOperator);
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

    paymentStatus = "en_verification";
    mobileMoneyOperatorName = operator.name;
  }

  try {
    await createOrder({
      ...input,
      shippingFee,
      freeShippingReached,
      paymentStatus,
      mobileMoneyOperator: mobileMoneyOperatorName,
    });
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

  await sendOrderReceivedNotifications(
    buildOrderDetail(input, {
      shippingFee,
      freeShippingReached,
      paymentStatus,
      mobileMoneyOperatorName,
    })
  );

  return { ok: true, shippingFee };
}

export interface StripeCheckoutResult {
  ok: boolean;
  error?: string;
  url?: string;
  shippingFee?: number;
}

/** Card payment via a Stripe-hosted Checkout page — Canada/US zones only
 *  (Stripe handles CAD/USD natively; Bénin keeps Mobile Money + WhatsApp). */
export async function createStripeCheckoutAction(
  input: OrderDraft
): Promise<StripeCheckoutResult> {
  if (input.zoneId !== "ca" && input.zoneId !== "us") {
    return { ok: false, error: "Le paiement par carte n'est pas disponible pour cette zone." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { ok: false, error: "Le paiement par carte n'est pas configuré pour le moment." };
  }

  const pricing = await computeOrderPricing(input);
  if (!pricing.ok) return pricing;
  const { shippingFee, freeShippingReached } = pricing;

  try {
    await createOrder({
      ...input,
      shippingFee,
      freeShippingReached,
      paymentStatus: "en_attente",
      paymentMethod: "stripe",
    });
  } catch {
    return { ok: false, error: "Erreur lors de la création de la commande." };
  }

  await sendOrderReceivedNotifications(
    buildOrderDetail(input, {
      shippingFee,
      freeShippingReached,
      paymentStatus: "en_attente",
    })
  );

  const currency = ZONES[input.zoneId].currency.toLowerCase();
  const siteUrl = getSiteUrl();

  const lineItems = [
    ...input.items.map((item) => ({
      price_data: {
        currency,
        product_data: { name: item.name },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.quantity,
    })),
    ...(shippingFee > 0
      ? [
          {
            price_data: {
              currency,
              product_data: { name: "Livraison" },
              unit_amount: Math.round(shippingFee * 100),
            },
            quantity: 1,
          },
        ]
      : []),
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: input.customer.email || undefined,
      success_url: `${siteUrl}/commande/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/commande`,
      metadata: { orderId: input.id },
      payment_intent_data: { metadata: { orderId: input.id } },
    });

    if (!session.url) {
      return { ok: false, error: "Erreur lors de la création de la session de paiement." };
    }

    await setOrderStripeSession(input.id, session.id);

    return { ok: true, url: session.url, shippingFee };
  } catch {
    return { ok: false, error: "Erreur lors de la connexion à Stripe. Réessayez." };
  }
}
