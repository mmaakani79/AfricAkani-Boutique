// Pure types/constants for reviews — safe to import from client components.
// Never import "./reviews-db" (or "./db") from a client component: it pulls
// in the `pg` Node driver, which can't be bundled for the browser.

export type ReviewStatus = "en_attente" | "approuvee" | "rejetee";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "en_attente",
  "approuvee",
  "rejetee",
];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  en_attente: "En attente",
  approuvee: "Approuvé",
  rejetee: "Rejeté",
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  en_attente: "bg-amber-500 text-white",
  approuvee: "bg-brand-green text-white",
  rejetee: "bg-red-600 text-white",
};
