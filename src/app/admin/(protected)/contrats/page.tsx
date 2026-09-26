import type { Metadata } from "next";
import { getAllSignedContracts, getContractText } from "@/lib/contracts-db";
import { ContractTextForm } from "./contract-text-form";
import { ContractsList } from "./contracts-list";

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

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Contrats signés
      </h1>
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
