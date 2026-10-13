import type { Metadata } from "next";
import { getAllSignedContracts, getContractText } from "@/lib/contracts-db";
import { ContractTextForm } from "./contract-text-form";
import { ContractsList } from "./contracts-list";
import { contractHasEmailFailure } from "@/lib/contract-email-delivery";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contrats signés — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminContratsPage() {
  const [contracts, contractText] = await Promise.all([
    getAllSignedContracts(),
    getContractText(),
  ]);

  const failedCount = contracts.filter((c) => contractHasEmailFailure(c)).length;

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Contrats signés
      </h1>
      {failedCount > 0 && (
        <p
          role="alert"
          data-testid="contract-email-alert"
          className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {failedCount === 1
              ? "1 contrat a un e-mail qui n'a pas pu être envoyé."
              : `${failedCount} contrats ont un e-mail qui n'a pas pu être envoyé.`}{" "}
            Voyez le détail et utilisez « Renvoyer » dans la liste ci-dessous.
          </span>
        </p>
      )}
      <p className="mt-1 text-sm text-ink/60">
        Contrats envoyés via la page publique{" "}
        <span className="font-semibold">/contrat</span>, avec signature
        électronique et cahier des charges du client.
      </p>

      <h2 className="mt-8 font-brand text-xl font-bold text-brand-green-dark">
        Texte du contrat
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Affiché aux clients sur la page /contrat avant qu&rsquo;ils ne
        signent. Modifiable ici, sans déploiement.
      </p>
      <div className="mt-4">
        <ContractTextForm contractText={contractText} />
      </div>

      <h2 className="mt-8 font-brand text-xl font-bold text-brand-green-dark">
        Contrats reçus ({contracts.length})
      </h2>
      {contracts.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
          Aucun contrat signé pour le moment.
        </p>
      ) : (
        <ContractsList contracts={contracts} />
      )}
    </div>
  );
}
