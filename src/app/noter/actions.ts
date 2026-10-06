"use server";

import { getOrderForTracking, toCustomerOrder, type OrderDetail } from "@/lib/orders-db";
import { getReviewsForOrder, submitReview, type Review } from "@/lib/reviews-db";

export interface ReviewLookupState {
  error?: string;
  order?: OrderDetail;
  contact?: string;
  existingByProductId?: Record<string, Review>;
}

export async function lookupOrderForReviewAction(
  _prevState: ReviewLookupState,
  formData: FormData
): Promise<ReviewLookupState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!orderId || !contact) {
    return {
      error:
        "Merci de renseigner le numéro de commande et votre e-mail ou téléphone.",
    };
  }

  const order = await getOrderForTracking(orderId, contact);
  if (!order) {
    return {
      error:
        "Aucune commande trouvée avec ces informations. Vérifiez le numéro de commande et l'e-mail ou le téléphone utilisés lors de la commande.",
    };
  }

  if (order.status !== "livree") {
    return {
      error:
        "Cette commande n'a pas encore été marquée comme livrée. Vous pourrez la noter dès sa livraison.",
    };
  }

  const existing = await getReviewsForOrder(orderId);
  const existingByProductId = Object.fromEntries(
    existing.map((r) => [r.productId, r])
  );

  return { order: toCustomerOrder(order), contact, existingByProductId };
}

export interface ReviewSubmitState {
  error?: string;
  success?: boolean;
}

export async function submitReviewsAction(
  _prevState: ReviewSubmitState,
  formData: FormData
): Promise<ReviewSubmitState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  // Re-verify server-side — the hidden orderId/contact fields are not trusted
  // just because they round-tripped through the form.
  const order = await getOrderForTracking(orderId, contact);
  if (!order || order.status !== "livree") {
    return { error: "Commande introuvable ou pas encore livrée." };
  }

  let submitted = 0;
  for (const item of order.items) {
    const rating = Number(formData.get(`rating_${item.productId}`) ?? 0);
    if (rating < 1) continue;
    const comment = String(formData.get(`comment_${item.productId}`) ?? "").trim();
    await submitReview({
      productId: item.productId,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      rating,
      comment,
    });
    submitted++;
  }

  if (submitted === 0) {
    return { error: "Merci de donner au moins une note avant d'envoyer." };
  }

  return { success: true };
}
