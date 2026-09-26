import type { Metadata } from "next";
import { FileSignature } from "lucide-react";
import { Container } from "@/components/layout/container";
import { getContractText } from "@/lib/contracts-db";
import { ContractForm } from "./contract-form";

export const metadata: Metadata = {
  title: "Contrat de prestation — AkaGestSoft",
  description:
    "Lisez le contrat de prestation AkaGestSoft, remplissez votre cahier des charges et signez électroniquement.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/contrat" },
};

export const dynamic = "force-dynamic";

export default async function ContratPage() {
  const contractText = await getContractText();

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-2xl text-center">
        <FileSignature className="mx-auto h-10 w-10 text-brand-gold" />
        <h1 className="mt-2 font-brand text-3xl font-bold text-brand-green-dark">
          Contrat de prestation
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Lisez le contrat, remplissez votre cahier des charges, puis signez
          électroniquement pour lancer votre projet avec AkaGestSoft.
        </p>
      </div>
      <div className="mt-8">
        <ContractForm contractText={contractText} />
      </div>
    </Container>
  );
}
