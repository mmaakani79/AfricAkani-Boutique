"use server";

import {
  createOrder,
  setOrderEmailError,
  type OrderDetail,
  type OrderInput,
} from "@/lib/orders-db";
import {
  formatEmailError,
  sendAdminNewOrderNotification,
  sendCustomerOrderConfirmation,
} from "@/lib/email";

export async function submitOrderAction(input: OrderInput): Promise<void> {
  await createOrder(input);

  const orderDetail: OrderDetail = {
    id: input.id,
    createdAt: new Date().toISOString(),
    zoneId: input.zoneId,
    subtotal: input.subtotal,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    customerEmail: input.customer.email,
    customerAddress: input.customer.address,
    customerCity: input.customer.city,
    freeShippingReached: input.freeShippingReached,
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
}
