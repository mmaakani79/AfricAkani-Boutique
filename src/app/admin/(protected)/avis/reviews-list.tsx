"use client";

import { useTransition } from "react";
import { Check, X, Trash2, Undo2 } from "lucide-react";
import type { Review } from "@/lib/reviews-db";
import { REVIEW_STATUS_COLORS, REVIEW_STATUS_LABELS } from "@/lib/review-types";
import { StarRatingDisplay } from "@/components/shop/star-rating";
import { setReviewStatusAction, deleteReviewAction } from "./actions";

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </ul>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-brand-green-dark">
              {review.productName || review.productId}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${REVIEW_STATUS_COLORS[review.status]}`}
            >
              {REVIEW_STATUS_LABELS[review.status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/50">
            {review.customerName}
            {review.orderId ? ` — commande ${review.orderId}` : ""} —{" "}
            {new Date(review.createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <StarRatingDisplay average={review.rating} count={1} showCount={false} size="md" />
      </div>

      {review.comment && (
        <p className="mt-3 whitespace-pre-line text-sm text-ink/70">{review.comment}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {review.status !== "approuvee" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setReviewStatusAction(review.id, "approuvee"))
            }
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-green px-3.5 py-1.5 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> Approuver
          </button>
        )}
        {review.status !== "rejetee" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setReviewStatusAction(review.id, "rejetee"))
            }
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-green/20 px-3.5 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" /> Rejeter
          </button>
        )}
        {review.status !== "en_attente" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setReviewStatusAction(review.id, "en_attente"))
            }
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-green/20 px-3.5 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
          >
            <Undo2 className="h-3.5 w-3.5" /> Remettre en attente
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Supprimer définitivement cet avis ? Cette action est irréversible.")) {
              startTransition(() => deleteReviewAction(review.id));
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
