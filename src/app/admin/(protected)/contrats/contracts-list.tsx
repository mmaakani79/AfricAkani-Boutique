"use client";

import { useTransition } from "react";
import { Download, Trash2, Phone, Mail } from "lucide-react";
import type { SignedContract } from "@/lib/contracts-db";
import { deleteSignedContractAction } from "./actions";

export function ContractsList({ contracts }: { contracts: SignedContract[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {contracts.map((contract) => (
        <ContractRow key={contract.id} contract={contract} />
      ))}
    </ul>
  );
}

function ContractRow({ contract }: { contract: SignedContract }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-brand-green-dark">{contract.clientName}</span>
            {contract.companyName && (
              <span className="text-xs text-ink/50">— {contract.companyName}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink/50">
            {contract.id} —{" "}
            {new Date(contract.createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contract.services.map((service) => (
            <span
              key={service}
              className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-green-dark"
            >
              {service}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <a
          href={`https://wa.me/${contract.clientPhone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
        >
          <Phone className="h-3.5 w-3.5" /> {contract.clientPhone}
        </a>
        <a
          href={`mailto:${contract.clientEmail}`}
          className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
        >
          <Mail className="h-3.5 w-3.5" /> {contract.clientEmail}
        </a>
      </div>

      <p className="mt-2 text-sm text-ink/70">{contract.projectDescription}</p>
      {(contract.budget || contract.timeline) && (
        <p className="mt-1 text-xs text-ink/50">
          {contract.budget && `Budget : ${contract.budget}`}
          {contract.budget && contract.timeline && " · "}
          {contract.timeline && `Délai : ${contract.timeline}`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={`/api/admin/contrats/${contract.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-green px-3.5 py-1.5 text-xs font-bold text-ivory hover:bg-brand-green-dark"
        >
          <Download className="h-3.5 w-3.5" /> Télécharger le PDF
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                `Supprimer définitivement le contrat ${contract.id} ? Cette action est irréversible.`
              )
            ) {
              startTransition(() => deleteSignedContractAction(contract.id));
            }
          }}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
      </div>
    </li>
  );
}
