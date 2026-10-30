import Link from "next/link";
import type { Metadata } from "next";
import { getAllSignedContracts } from "@/lib/contracts-db";
import { NewAccountForm, type ContractOption } from "./new-account-form";

export const metadata: Metadata = {
  title: "Nouveau dossier de paiement — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewServiceAccountPage() {
  const contracts = await getAllSignedContracts();
  const options: ContractOption[] = contracts.map((c) => ({
    id: c.id,
    label: `${c.companyName || c.clientName} — signé le ${new Date(c.createdAt).toLocaleDateString("fr-FR")} (${c.id})`,
    merchantName: c.companyName || c.clientName,
    phone: c.clientPhone,
  }));
  return (
    <div>
      <Link href="/admin/services" className="text-xs font-semibold text-brand-green-dark hover:underline">
        ← Services
      </Link>
      <h1 className="mt-2 font-brand text-2xl font-bold text-brand-green-dark">Nouveau dossier de paiement</h1>
      <p className="mt-1 text-sm text-ink/60">
        Un dossier par marchand : prix, acompte, tranches choisies par vous, et un lien privé à lui envoyer.
      </p>
      <div className="mt-5">
        <NewAccountForm contracts={options} />
      </div>
    </div>
  );
}
