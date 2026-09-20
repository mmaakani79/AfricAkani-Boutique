"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, X, CheckCircle2 } from "lucide-react";
import {
  submitProductRequestAction,
  type ProductRequestState,
} from "@/lib/product-request-actions";

const initialState: ProductRequestState = {};

export function ProductRequestCard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="rounded-2xl border border-brand-gold-light/40 p-4">
        <p className="text-sm font-bold text-brand-gold-light">
          Vous ne trouvez pas un produit ?
        </p>
        <p className="mt-1.5 text-sm text-white">
          Dites-nous ce que vous cherchez, nous le trouvons pour vous.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="scallop-btn mt-4"
        >
          <span className="scallop-btn__ring" aria-hidden />
          <span className="scallop-btn__glass" aria-hidden />
          <span className="scallop-btn__content">
            <Mail className="h-4 w-4" aria-hidden />
            Faire une demande
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <ProductRequestDialog onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function ProductRequestDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(
    submitProductRequestAction,
    initialState
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-brand text-xl font-bold text-brand-green-dark">
              Vous ne trouvez pas un produit ?
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Dites-nous ce que vous cherchez, on vous répond rapidement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-ink/50 hover:bg-ivory"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.success ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-brand-green" />
            <p className="text-sm font-semibold text-brand-green-dark">
              Merci ! Votre demande a bien été envoyée.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-brand-green px-5 py-2 text-sm font-bold text-ivory hover:bg-brand-green-dark"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form action={formAction} className="mt-5 space-y-4">
            <Field label="Nom du produit recherché" name="productName" required />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">
                Description (facultatif)
              </span>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
              />
            </label>
            <Field
              label="Téléphone / WhatsApp"
              name="phone"
              type="tel"
              required
            />
            <Field
              label="Email (facultatif)"
              name="email"
              type="email"
            />

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Envoyer ma demande"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
      />
    </label>
  );
}
