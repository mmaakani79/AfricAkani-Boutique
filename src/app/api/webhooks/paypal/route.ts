import { NextRequest, NextResponse } from "next/server";
import { isPaypalWebhookConfigured, verifyPaypalWebhookSignature } from "@/lib/paypal";
import { getOrderById, markPaypalOrderPaid, setOrderEmailError } from "@/lib/orders-db";
import { formatEmailError, sendCustomerPaymentConfirmed } from "@/lib/email";

export const dynamic = "force-dynamic";

interface PaypalCaptureCompletedEvent {
  event_type: string;
  resource: {
    id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    custom_id?: string;
  };
}

/** Defense-in-depth alongside the synchronous capture on
 *  /commande/succes — PayPal will retry this on failure, so a customer
 *  whose browser never made it back to the return URL (closed tab, network
 *  drop) still gets their order marked paid. Requires PAYPAL_WEBHOOK_ID to
 *  be set (Réglages shows whether it is) — until then this just reports
 *  "not configured" rather than accepting unverified events. */
export async function POST(request: NextRequest) {
  if (!isPaypalWebhookConfigured()) {
    console.error("[paypal webhook] PAYPAL_WEBHOOK_ID is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const body = (await request.json()) as PaypalCaptureCompletedEvent;

  const verified = await verifyPaypalWebhookSignature({
    headers: request.headers,
    body,
  });
  if (!verified) {
    console.error("[paypal webhook] Signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = body.resource.custom_id;
    const captureId = body.resource.id ?? null;
    if (orderId) {
      const justPaid = await markPaypalOrderPaid(orderId, captureId);
      if (justPaid) {
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
    }
  }

  return NextResponse.json({ received: true });
}
