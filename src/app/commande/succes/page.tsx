import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { getStripeClient } from "@/lib/stripe";
import { getOrderById } from "@/lib/orders-db";
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

export default async function CommandeSuccesPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) return <UnknownStatus />;

  let orderId: string | null = null;
  let paid = false;
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    orderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : null;
    paid = session.payment_status === "paid";
  } catch {
    orderId = null;
  }

  const order = orderId ? await getOrderById(orderId) : null;
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
