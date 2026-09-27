import type { Metadata } from "next";
import { getAllShippingSettings } from "@/lib/shipping-settings-db";
import { getAllOperators, getBeneficiaryName } from "@/lib/mobile-money-db";
import { getStripeKeyMode, isStripeWebhookConfigured } from "@/lib/stripe";
import { getPaypalMode, isPaypalWebhookConfigured } from "@/lib/paypal";
import { ShippingSettingsForm } from "./shipping-settings-form";
import { MobileMoneyForm } from "./mobile-money-form";

function StatusPill({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  const color = ok ? "bg-brand-green text-white" : warn ? "bg-amber-500 text-white" : "bg-red-600 text-white";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${color}`}>
      {children}
    </span>
  );
}

export const metadata: Metadata = {
  title: "Réglages — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminReglagesPage() {
  const [settings, operators, beneficiaryName] = await Promise.all([
    getAllShippingSettings(),
    getAllOperators(),
    getBeneficiaryName(),
  ]);

  const stripeMode = getStripeKeyMode();
  const webhookOk = isStripeWebhookConfigured();
  const paypalMode = getPaypalMode();
  const paypalWebhookOk = isPaypalWebhookConfigured();

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Réglages
      </h1>

      <h2 className="mt-6 font-brand text-xl font-bold text-brand-green-dark">
        Paiement par carte (Stripe)
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Une carte de test (4242 4242 4242 4242) n&rsquo;est acceptée qu&rsquo;en
        mode test — avec des clés LIVE, elle est toujours refusée, ce qui est
        normal et ne signale pas un problème sur le site.
      </p>
      <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-ink/70">Clé secrète :</span>
          {stripeMode === "live" && <StatusPill ok>Mode LIVE</StatusPill>}
          {stripeMode === "test" && (
            <StatusPill warn>Mode TEST — cartes réelles non facturées</StatusPill>
          )}
          {stripeMode === "non_configuree" && (
            <StatusPill>Non configurée — « Payer par carte » masqué</StatusPill>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-ink/70">Webhook :</span>
          {webhookOk ? (
            <StatusPill ok>Configuré</StatusPill>
          ) : (
            <StatusPill>
              Non configuré — les commandes payées ne passeront jamais
              automatiquement à « Payé »
            </StatusPill>
          )}
        </div>
      </div>

      <h2 className="mt-10 font-brand text-xl font-bold text-brand-green-dark">
        Paiement PayPal
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        « Payer avec PayPal » est proposé aux côtés de Stripe, uniquement
        pour les zones Canada et États-Unis.
      </p>
      <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-ink/70">Clés API :</span>
          {paypalMode === "live" && <StatusPill ok>Mode LIVE</StatusPill>}
          {paypalMode === "sandbox" && (
            <StatusPill warn>Mode SANDBOX — paiements réels non facturés</StatusPill>
          )}
          {paypalMode === "non_configuree" && (
            <StatusPill>Non configurées — « Payer avec PayPal » masqué</StatusPill>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-ink/70">Webhook :</span>
          {paypalWebhookOk ? (
            <StatusPill ok>Configuré</StatusPill>
          ) : (
            <StatusPill warn>
              Non configuré — la commande est tout de même marquée « Payé »
              au retour du client depuis PayPal ; le webhook n&rsquo;est
              qu&rsquo;une sécurité en plus si ce retour échoue
            </StatusPill>
          )}
        </div>
      </div>

      <h2 className="mt-10 font-brand text-xl font-bold text-brand-green-dark">
        Livraison
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Frais de livraison par zone. Sous le seuil, les frais s&rsquo;ajoutent
        au sous-total ; à partir du seuil, la livraison est gratuite. Ces
        valeurs s&rsquo;appliquent immédiatement sur le site, sans
        déploiement.
      </p>

      <ShippingSettingsForm settings={settings} />

      <h2 className="mt-10 font-brand text-xl font-bold text-brand-green-dark">
        Paiement Mobile Money
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Codes de transfert marchand et bénéficiaire affichés au client au
        paiement (zone Bénin &amp; Afrique de l&rsquo;Ouest).
      </p>
      <div className="mt-6">
        <MobileMoneyForm beneficiaryName={beneficiaryName} operators={operators} />
      </div>
    </div>
  );
}
