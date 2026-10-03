"use server";

import { requireAdmin } from "@/lib/admin-api-auth";

import { revalidatePath } from "next/cache";
import { deleteReview, setReviewStatus } from "@/lib/reviews-db";
import type { ReviewStatus } from "@/lib/review-types";

export async function setReviewStatusAction(
  id: number,
  status: ReviewStatus
): Promise<void> {
  await requireAdmin();
  await setReviewStatus(id, status);
  revalidatePath("/admin/avis");
}

export async function deleteReviewAction(id: number): Promise<void> {
  await requireAdmin();
  await deleteReview(id);
  revalidatePath("/admin/avis");
}
