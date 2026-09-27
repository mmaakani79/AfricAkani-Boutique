import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { getStripeClient } from "@/lib/stripe";
import { capturePaypalOrder } from "@/lib/paypal";
import { getOrderById, markPaypalOrderPaid, setOrderEmailError } from "@/lib/orders-db";
import { formatEmailError, sendCustomerPaymentConfirmed } from "@/lib/email";
import { formatPrice } from "@/data/zones";

export const metadata: Metadata = {
  title: "Commande confirmée — AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function UnknownStatus() {
  return (
    <Container className="py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm text-ink/60">
          Nous n&rsquo;avons pas pu confirmer votre paiement immédiatement. Si
          le montant a bien été débité, votre commande sera automatiquement
          mise à jour sous peu — vous pouvez suivre son statut ici :{" "}
          <Link href="/suivi" className="font-semibold text-brand-green">
            Suivre ma commande
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}

/** PayPal has no guaranteed webhook configured (that needs a webhook id set
 *  up separately in the PayPal dashboard), so this return page is the
 *  primary place the capture happens and the order gets marked paid —
 *  unlike Stripe, which relies on /api/webhooks/stripe for that. */
async function capturePaypalReturn(paypalOrderId: string, orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order || order.paypalOrderId !== paypalOrderId) return false;

  let captureId: string | null = null;
  try {
    const result = await capturePaypalOrder(paypalOrderId);
    if (!result.ok) return false;
    captureId = result.captureId;
  } catch (err) {
    console.error(`[paypal] Échec de la capture pour la commande ${orderId}.`, err);
    return false;
  }

  const justPaid = await markPaypalOrderPaid(orderId, captureId);
  if (justPaid) {
    try {
      const paidOrder = await getOrderById(orderId);
      if (paidOrder) {
        await sendCustomerPaymentConfirmed(paidOrder);
        await setOrderEmailError(orderId, null);
      }
    } catch (err) {
      const message = `e-mail « paiement confirmé » : ${formatEmailError(err)}`;
      console.error(`[email] Commande ${orderId} : ${message}`);
      await setOrderEmailError(orderId, message);
    }
  }

  return true;
}

export default async function CommandeSuccesPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; token?: string; order_id?: string }>;
}) {
  const { session_id: sessionId, token: paypalOrderId, order_id: paypalOrderRef } =
    await searchParams;

  let orderId: string | null = null;
  let paid = false;

  if (sessionId) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      orderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : null;
      paid = session.payment_status === "paid";
    } catch (err) {
      console.error(`[stripe] Impossible de récupérer la session ${sessionId}.`, err);
      orderId = null;
    }
  } else if (paypalOrderId && paypalOrderRef) {
    orderId = paypalOrderRef;
    paid = await capturePaypalReturn(paypalOrderId, paypalOrderRef);
  }

  if (!orderId) return <UnknownStatus />;

  const order = await getOrderById(orderId);
  if (!order || !paid) return <UnknownStatus />;

  return (
    <Container className="py-24">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-brand-green" />
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Merci, {order.customerName.split(" ")[0] || "votre commande est confirmée"} !
        </h1>
        <p className="text-sm text-ink/60">
          Votre commande <span className="font-semibold">{order.id}</span> a
          bien été enregistrée et votre paiement confirmé. Vous la
          retrouverez dans votre espace « Mon compte ».
        </p>
        <div className="w-full max-w-xs space-y-1.5 rounded-xl bg-white p-4 text-sm">
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
          <div className="flex justify-between border-t border-brand-green/10 pt-1.5 font-bold text-brand-green-dark">
            <span>Total</span>
            <span>
              {formatPrice(order.subtotal + order.shippingFee, order.zoneId)}
            </span>
          </div>
        </div>
        <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-xs font-semibold text-brand-green-dark">
          Nous préparons votre commande et vous recontacterons pour organiser
          la livraison.
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
        <Link
          href={`/suivi?commande=${order.id}`}
          className="text-xs font-semibold text-brand-green-dark underline-offset-2 hover:underline"
        >
          Suivre ma commande
        </Link>
      </div>
    </Container>
  );
}
