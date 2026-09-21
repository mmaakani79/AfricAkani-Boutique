"use server";

import { revalidatePath } from "next/cache";
import {
  deleteProductRequest,
  deleteProductRequests,
  getProductRequestById,
  markProductRequestEmailSent,
  setProductRequestHandled,
} from "@/lib/product-requests-db";
import {
  formatEmailError,
  sendProductRequestNotification,
} from "@/lib/email";

export async function toggleHandledAction(
  id: number,
  handled: boolean
): Promise<void> {
  await setProductRequestHandled(id, handled);
  revalidatePath("/admin/demandes");
}

export async function deleteRequestAction(id: number): Promise<void> {
  await deleteProductRequest(id);
  revalidatePath("/admin/demandes");
}

export async function deleteRequestsAction(ids: number[]): Promise<void> {
  await deleteProductRequests(ids);
  revalidatePath("/admin/demandes");
}

export interface ResendResult {
  ok: boolean;
  detail: string;
}

export async function resendNotificationAction(
  id: number
): Promise<ResendResult> {
  const request = await getProductRequestById(id);
  if (!request) {
    return { ok: false, detail: "Demande introuvable." };
  }
  try {
    await sendProductRequestNotification(request);
    await markProductRequestEmailSent(id);
    revalidatePath("/admin/demandes");
    return { ok: true, detail: "Notification renvoyée." };
  } catch (err) {
    return { ok: false, detail: formatEmailError(err) };
  }
}
