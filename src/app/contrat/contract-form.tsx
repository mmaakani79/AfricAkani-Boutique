"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Download } from "lucide-react";
import { CONTRACT_SERVICES } from "@/lib/contract-types";
import { SignaturePad, type SignaturePadHandle } from "@/components/shop/signature-pad";
import { submitSignedContractAction } from "./actions";

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      />
    </label>
  );
}

export function ContractForm({ contractText }: { contractText: string }) {
  const [contractId] = useState(() => `CT-${Date.now().toString(36).toUpperCase()}`);
  const [readAccepted, setReadAccepted] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [projectDescription, setProjectDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedContractId, setSignedContractId] = useState<string | null>(null);
  const signatureRef = useRef<SignaturePadHandle>(null);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const signatureDataUrl = signatureRef.current?.getDataUrl();
    if (!signatureDataUrl) {
      setError("Merci de signer dans le cadre prévu avant d'envoyer le contrat.");
      return;
    }

    setSubmitting(true);
    const result = await submitSignedContractAction({
      id: contractId,
      clientName,
      clientEmail,
      clientPhone,
      companyName,
      services,
      projectDescription,
      budget,
      timeline,
      notes,
      signatureDataUrl,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Une erreur est survenue. Merci de réessayer.");
      return;
    }
    setSignedContractId(result.contractId ?? contractId);
  }

  if (signedContractId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand-green" />
        <h2 className="mt-3 font-brand text-xl font-bold text-brand-green-dark">
          Contrat signé avec succès
        </h2>
        <p className="mt-2 text-sm text-ink/60">
          Votre contrat <span className="font-semibold">{signedContractId}</span> a
          bien été enregistré. Notre équipe vous recontactera prochainement.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          Retour à l&rsquo;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl bg-white p-5">
        <h2 className="flex items-center gap-2 font-brand text-lg font-bold text-brand-green-dark">
          <FileText className="h-5 w-5 text-brand-gold" /> Contrat AkaGestSoft
        </h2>
        <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-brand-green/10 bg-ivory p-4 text-xs leading-relaxed text-ink/70">
          {contractText}
        </div>
        <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-ink/70">
          <input
            type="checkbox"
            checked={readAccepted}
            onChange={(e) => setReadAccepted(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          J&rsquo;ai lu et j&rsquo;accepte les termes du contrat ci-dessus.
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-5">
        <h2 className="font-brand text-lg font-bold text-brand-green-dark">
          Cahier des charges
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" value={clientName} onChange={setClientName} required />
          <Field label="Nom de l'entreprise" value={companyName} onChange={setCompanyName} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" type="email" value={clientEmail} onChange={setClientEmail} required />
          <Field label="Téléphone" type="tel" value={clientPhone} onChange={setClientPhone} required />
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold text-ink/60">
            Service(s) souhaité(s) <span className="text-red-500">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                  services.includes(service)
                    ? "border-brand-green bg-brand-green text-ivory"
                    : "border-brand-green/20 text-brand-green-dark"
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Description du besoin <span className="text-red-500">*</span>
          </span>
          <textarea
            required
            rows={4}
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Décrivez votre projet, votre activité, ce que vous souhaitez obtenir…"
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget estimé" value={budget} onChange={setBudget} placeholder="Ex. 500 000 FCFA" />
          <Field label="Délai souhaité" value={timeline} onChange={setTimeline} placeholder="Ex. 6 semaines" />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Précisions complémentaires
          </span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Signature électronique <span className="text-red-500">*</span>
          </span>
          <SignaturePad ref={signatureRef} />
        </div>

        <button
          type="submit"
          disabled={!readAccepted || submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {submitting ? "Envoi…" : "Signer et envoyer le contrat"}
        </button>
        {!readAccepted && (
          <p className="text-center text-[11px] text-ink/40">
            Cochez la case ci-dessus pour activer la signature.
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
