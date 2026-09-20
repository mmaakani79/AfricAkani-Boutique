"use server";

import { createProductRequest, markProductRequestEmailSent } from "./product-requests-db";
import { sendProductRequestNotification } from "./email";

export interface ProductRequestState {
  error?: string;
  success?: boolean;
}

export async function submitProductRequestAction(
  _prevState: ProductRequestState,
  formData: FormData
): Promise<ProductRequestState> {
  const productName = String(formData.get("productName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!productName || !phone) {
    return { error: "Merci d'indiquer au moins le nom du produit et un numéro de téléphone." };
  }

  const request = await createProductRequest({ productName, description, phone, email });

  try {
    await sendProductRequestNotification(request);
    await markProductRequestEmailSent(request.id);
  } catch {
    // The request is already saved and visible in /admin/demandes even if
    // the email notification couldn't be sent (e.g. SMTP not configured).
  }

  return { success: true };
}
