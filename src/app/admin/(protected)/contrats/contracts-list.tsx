"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, Phone, Mail, Send } from "lucide-react";
import type { ContractEmailTarget, SignedContract } from "@/lib/contracts-db";
import { contractEmailStatus, type ContractEmailStatus } from "@/lib/contract-email-delivery";
import { deleteSignedContractAction, resendContractEmailAction } from "./actions";

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

const STATUS_STYLE: Record<ContractEmailStatus["kind"], string> = {
  sent: "bg-brand-green/10 text-brand-green-dark",
  failed: "bg-red-50 text-red-700",
  sending: "bg-amber-50 text-amber-800",
  not_sent: "bg-ink/5 text-ink/60",
};

function statusLabel(status: ContractEmailStatus): string {
  switch (status.kind) {
    case "sent":
      return `Envoyé le ${new Date(status.at).toLocaleString("fr-FR", SHORT_DATE)}`;
    case "failed":
      return "Échec d'envoi";
    case "sending":
      return "Envoi en cours…";
    case "not_sent":
      return "Non envoyé";
  }
}

/** One e-mail of the contract (admin notification or client copy): its state, the
 *  reason when it failed, and a button to send it again. */
function EmailLine({
  contract,
  target,
  title,
}: {
  contract: SignedContract;
  target: ContractEmailTarget;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const status = contractEmailStatus(contract.emails[target]);

  function resend() {
    if (
      status.kind === "sent" &&
      !window.confirm(
        `Cet e-mail a déjà été envoyé (${statusLabel(status).toLowerCase()}). Le renvoyer quand même ?`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await resendContractEmailAction(contract.id, target, true);
        setMessage({ ok: result.ok, text: result.message });
      } catch {
        setMessage({ ok: false, text: "Connexion impossible : rien n'a été renvoyé. Réessayez." });
      }
    });
  }

  return (
    <div data-testid={`contract-email-${target}`} data-status={status.kind} className="text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-all font-semibold text-ink/70">{title}</span>
        <span className={`rounded-full px-2.5 py-0.5 font-bold ${STATUS_STYLE[status.kind]}`}>
          {statusLabel(status)}
        </span>
        <button
          type="button"
          disabled={pending || status.kind === "sending"}
          onClick={resend}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-brand-green/20 px-2.5 py-0.5 font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
        >
          <Send className="h-3 w-3" /> {pending ? "Envoi…" : "Renvoyer"}
        </button>
      </div>
      {status.kind === "failed" && (
        <p className="mt-1 break-words rounded-lg bg-red-50 px-2.5 py-1.5 font-semibold text-red-700">
          {status.error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className={`mt-1 break-words font-semibold ${message.ok ? "text-brand-green-dark" : "text-red-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

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
          className="flex min-w-0 max-w-full items-center gap-1.5 break-all font-semibold text-brand-green hover:underline"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" /> {contract.clientEmail}
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

      <div className="mt-4 space-y-2 rounded-xl border border-brand-green/10 bg-ivory/60 p-3">
        <EmailLine contract={contract} target="admin" title="Notification à l'administrateur" />
        <EmailLine
          contract={contract}
          target="client"
          title={`Copie PDF au client (${contract.clientEmail})`}
        />
      </div>

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
