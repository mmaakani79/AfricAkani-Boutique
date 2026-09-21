import { formatPrice } from "@/data/zones";
import type { OrderSummary } from "./orders-db";

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export function whatsappReminderHref(order: OrderSummary): string {
  const phone = normalizePhone(order.customerPhone).replace(/^\+/, "");
  const total = order.subtotal + order.shippingFee;
  const message = [
    `Bonjour ${order.customerName.split(" ")[0] || ""},`,
    `Votre commande ${order.id} (${formatPrice(total, order.zoneId)}) chez AfricAkani est toujours en attente de paiement.`,
    "Pouvez-vous nous confirmer le règlement ? Merci !",
  ].join(" ");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function whatsappPaymentConfirmedHref(order: OrderSummary): string {
  const phone = normalizePhone(order.customerPhone).replace(/^\+/, "");
  const total = order.subtotal + order.shippingFee;
  const message = `Bonjour ${order.customerName.split(" ")[0] || ""}, AfricAkani a bien reçu votre paiement de ${formatPrice(total, order.zoneId)} pour la commande ${order.id}. Merci !`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
