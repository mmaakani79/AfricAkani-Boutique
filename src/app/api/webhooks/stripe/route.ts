import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getOrderById, markStripeOrderPaid, setOrderEmailError } from "@/lib/orders-db";
import { formatEmailError, sendCustomerPaymentConfirmed } from "@/lib/email";

export const dynamic = "force-dynamic";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const justPaid = await markStripeOrderPaid(orderId, paymentIntentId);
  if (!justPaid) return; // already processed (order not found, or a retried webhook)

  try {
    const order = await getOrderById(orderId);
    if (order) {
      await sendCustomerPaymentConfirmed(order);
      await setOrderEmailError(orderId, null);
    }
  } catch (err) {
    const message = `e-mail « paiement confirmé » : ${formatEmailError(err)}`;
    console.error(`[email] Commande ${orderId} : ${message}`);
    await setOrderEmailError(orderId, message);
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }

  return NextResponse.json({ received: true });
}
