"use server";

import {
  getOrderForTracking,
  type OrderDetail,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders-db";

export interface TrackingState {
  error?: string;
  order?: OrderDetail;
}

export async function trackOrderAction(
  _prevState: TrackingState,
  formData: FormData
): Promise<TrackingState> {
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

  return { order };
}

/** Lightweight live-status lookup used by "Mon compte" to refresh each locally-saved order. */
export async function getOrderLiveStatusAction(
  orderId: string,
  contact: string
): Promise<{ status: OrderStatus; paymentStatus: PaymentStatus } | null> {
  const order = await getOrderForTracking(orderId, contact);
  if (!order) return null;
  return { status: order.status, paymentStatus: order.paymentStatus };
}
