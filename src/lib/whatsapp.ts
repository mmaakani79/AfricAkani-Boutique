import { formatPrice } from "@/data/zones";
import type { OrderSummary } from "./orders-db";

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export function whatsappReminderHref(order: OrderSummary): string {
  const phone = normalizePhone(order.customerPhone).replace(/^\+/, "");
  const message = [
    `Bonjour ${order.customerName.split(" ")[0] || ""},`,
    `Votre commande ${order.id} (${formatPrice(order.subtotal, order.zoneId)}) chez AfricAkani est toujours en attente de paiement.`,
    "Pouvez-vous nous confirmer le règlement (à la livraison ou par WhatsApp) ? Merci !",
  ].join(" ");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
