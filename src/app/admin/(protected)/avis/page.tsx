import type { Metadata } from "next";
import Link from "next/link";
import { getAllReviews } from "@/lib/reviews-db";
import type { ReviewStatus } from "@/lib/review-types";
import { REVIEW_STATUS_LABELS } from "@/lib/review-types";
import { ReviewsList } from "./reviews-list";

export const metadata: Metadata = {
  title: "Avis clients — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TABS: { value: ReviewStatus | "toutes"; label: string }[] = [
  { value: "en_attente", label: REVIEW_STATUS_LABELS.en_attente },
  { value: "approuvee", label: REVIEW_STATUS_LABELS.approuvee },
  { value: "rejetee", label: REVIEW_STATUS_LABELS.rejetee },
  { value: "toutes", label: "Toutes" },
];

export default async function AdminAvisPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const active: ReviewStatus | "toutes" =
    statut === "approuvee" || statut === "rejetee" || statut === "toutes"
      ? statut
      : "en_attente";

  const reviews = await getAllReviews(active === "toutes" ? undefined : active);

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Avis clients
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Modérez les avis envoyés par les clients depuis « Noter mes achats »
        avant qu&rsquo;ils n&rsquo;apparaissent sur la boutique.
      </p>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-brand-green/10">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/avis?statut=${tab.value}`}
            className={`rounded-t-lg px-3.5 py-2 text-sm font-semibold ${
              active === tab.value
                ? "bg-white text-brand-green-dark"
                : "text-ink/50 hover:text-brand-green-dark"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
          Aucun avis dans cette catégorie.
        </p>
      ) : (
        <ReviewsList reviews={reviews} />
      )}
    </div>
  );
}
