"use server";

import {
  createOrder,
  setOrderEmailError,
  type OrderDetail,
  type OrderInput,
} from "@/lib/orders-db";
import { getShippingSettings } from "@/lib/shipping-settings-db";
import { computeShippingFee, isBelowMinOrder } from "@/lib/shipping-calc";
import { roundForZone, formatPrice } from "@/data/zones";
import {
  formatEmailError,
  sendAdminNewOrderNotification,
  sendCustomerOrderConfirmation,
} from "@/lib/email";

export type OrderDraft = Omit<OrderInput, "shippingFee" | "freeShippingReached">;

export interface OrderSubmissionResult {
  ok: boolean;
  error?: string;
  shippingFee?: number;
}

export async function submitOrderAction(
  input: OrderDraft
): Promise<OrderSubmissionResult> {
  const settings = await getShippingSettings(input.zoneId);

  if (isBelowMinOrder(input.subtotal, settings)) {
    return {
      ok: false,
      error: `Montant minimum de commande pour cette zone : ${formatPrice(
        settings.minOrderAmount!,
        input.zoneId
      )}.`,
    };
  }

  const shippingFee = roundForZone(
    computeShippingFee(input.subtotal, settings),
    input.zoneId
  );
  const freeShippingReached = input.subtotal >= settings.freeShippingThreshold;

  await createOrder({ ...input, shippingFee, freeShippingReached });

  const orderDetail: OrderDetail = {
    id: input.id,
    createdAt: new Date().toISOString(),
    zoneId: input.zoneId,
    subtotal: input.subtotal,
    shippingFee,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    customerEmail: input.customer.email,
    customerAddress: input.customer.address,
    customerCity: input.customer.city,
    freeShippingReached,
    status: "nouvelle",
    paymentStatus: "en_attente",
    paymentMethod: null,
    isTest: false,
    reminder24hSentAt: null,
    reminder48hSentAt: null,
    emailError: null,
    items: input.items.map((i) => ({
      productId: i.productId,
      productName: i.name,
      productSku: i.sku ?? null,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    reminders: [],
  };

  // Notification emails are best-effort: the order itself is already saved,
  // so a Resend hiccup (or no RESEND_API_KEY configured yet) must never
  // block the customer's checkout flow. Failures are logged and surfaced
  // on the order's admin page instead of being silently swallowed.
  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminNewOrderNotification(orderDetail),
    sendCustomerOrderConfirmation(orderDetail),
  ]);

  const failures: string[] = [];
  if (adminResult.status === "rejected") {
    failures.push(`notification admin : ${formatEmailError(adminResult.reason)}`);
  }
  if (customerResult.status === "rejected") {
    failures.push(`confirmation client : ${formatEmailError(customerResult.reason)}`);
  }

  if (failures.length > 0) {
    const message = failures.join(" | ");
    console.error(`[email] Commande ${orderDetail.id} : e-mail(s) non envoyé(s) — ${message}`);
    await setOrderEmailError(orderDetail.id, message);
  } else {
    await setOrderEmailError(orderDetail.id, null);
  }

  return { ok: true, shippingFee };
}
