import type { Metadata } from "next";
import { getAllShippingSettings } from "@/lib/shipping-settings-db";
import { getAllOperators, getBeneficiaryName } from "@/lib/mobile-money-db";
import { ShippingSettingsForm } from "./shipping-settings-form";
import { MobileMoneyForm } from "./mobile-money-form";

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

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Réglages
      </h1>
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
