"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Star } from "lucide-react";
import { Container } from "@/components/layout/container";
import { StarRatingInput } from "@/components/shop/star-rating-input";
import {
  lookupOrderForReviewAction,
  submitReviewsAction,
  type ReviewLookupState,
  type ReviewSubmitState,
} from "./actions";

const initialLookupState: ReviewLookupState = {};
const initialSubmitState: ReviewSubmitState = {};

function ReviewForm({
  order,
  contact,
  existingByProductId,
}: NonNullable<
  Pick<ReviewLookupState, "order" | "contact" | "existingByProductId">
> & { order: NonNullable<ReviewLookupState["order"]> }) {
  const [state, formAction, pending] = useActionState(
    submitReviewsAction,
    initialSubmitState
  );

  if (state.success) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-6 text-center">
        <Star className="mx-auto h-8 w-8 text-brand-gold" fill="currentColor" strokeWidth={0} />
        <p className="mt-2 text-sm font-semibold text-brand-green-dark">
          Merci ! Votre avis a bien été envoyé et sera publié après vérification.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-2xl bg-white p-5">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="contact" value={contact} />

      {order.items.map((item) => {
        const existing = existingByProductId?.[item.productId];
        return (
          <div
            key={item.productId}
            className="space-y-2 border-t border-brand-green/10 pt-4 first:border-t-0 first:pt-0"
          >
            <p className="text-sm font-semibold text-brand-green-dark">
              {item.productName}
            </p>
            <StarRatingInput
              name={`rating_${item.productId}`}
              defaultValue={existing?.rating ?? 0}
            />
            <textarea
              name={`comment_${item.productId}`}
              defaultValue={existing?.comment ?? ""}
              rows={2}
              placeholder="Votre avis (facultatif)"
              className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
            />
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Publier mes avis"}
      </button>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

function LookupForm() {
  const searchParams = useSearchParams();
  const prefilledOrderId = searchParams.get("commande") ?? "";
  const [state, formAction, pending] = useActionState(
    lookupOrderForReviewAction,
    initialLookupState
  );

  return (
    <div className="mx-auto max-w-xl">
      <form action={formAction} className="space-y-4 rounded-2xl bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            Numéro de commande
          </span>
          <input
            type="text"
            name="orderId"
            defaultValue={prefilledOrderId}
            required
            placeholder="AK-..."
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/60">
            E-mail ou téléphone utilisé pour la commande
          </span>
          <input
            type="text"
            name="contact"
            required
            className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 text-sm outline-none focus:border-brand-green"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> {pending ? "Recherche…" : "Retrouver ma commande"}
        </button>
        {state.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {state.error}
          </p>
        )}
      </form>

      {state.order && (
        <ReviewForm
          order={state.order}
          contact={state.contact ?? ""}
          existingByProductId={state.existingByProductId}
        />
      )}
    </div>
  );
}

export default function NoterPage() {
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-xl text-center">
        <Star className="mx-auto h-10 w-10 text-brand-gold" fill="currentColor" strokeWidth={0} />
        <h1 className="mt-2 font-brand text-3xl font-bold text-brand-green-dark">
          Noter mes achats
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Entrez votre numéro de commande et l&rsquo;e-mail ou le téléphone
          utilisé lors de la commande pour noter les produits reçus.
        </p>
      </div>
      <div className="mt-8">
        <Suspense fallback={null}>
          <LookupForm />
        </Suspense>
      </div>
    </Container>
  );
}
