import { Resend } from "resend";
import type { ProductRequest } from "./product-requests-db";
import type { OrderDetail, OrderSummary } from "./orders-db";
import { ZONES, formatPrice } from "@/data/zones";
import { getAdminNotifyEmail, getPaymentTimeoutHours, getSiteUrl } from "./order-config";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  return new Resend(apiKey);
}

function getFrom(): string {
  // "onboarding@resend.dev" works with no setup and can send to any
  // recipient; once africakani.com is verified in Resend, set RESEND_FROM
  // to a branded address like "AfricAkani <no-reply@africakani.com>".
  return process.env.RESEND_FROM || "AfricAkani <onboarding@resend.dev>";
}

export async function sendProductRequestNotification(
  request: ProductRequest
): Promise<void> {
  const resend = getClient();
  const to = getAdminNotifyEmail();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to,
    replyTo: request.email || undefined,
    subject: `Nouvelle demande de produit : ${request.productName}`,
    text: [
      `Produit recherché : ${request.productName}`,
      request.description ? `Description : ${request.description}` : null,
      `Téléphone / WhatsApp : ${request.phone}`,
      request.email ? `Email : ${request.email}` : null,
      "",
      `Reçu le ${new Date(request.createdAt).toLocaleString("fr-FR")}`,
      "Voir toutes les demandes dans l'espace admin (/admin/demandes).",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

function itemsText(order: OrderDetail): string {
  return order.items
    .map(
      (i) =>
        `  ${i.quantity} × ${i.productName}${i.productSku ? ` (SKU ${i.productSku})` : ""} — ${formatPrice(i.lineTotal, order.zoneId)}`
    )
    .join("\n");
}

export async function sendAdminNewOrderNotification(
  order: OrderDetail
): Promise<void> {
  const resend = getClient();
  const to = getAdminNotifyEmail();
  const siteUrl = getSiteUrl();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to,
    subject: `Nouvelle commande ${order.id} — ${formatPrice(order.subtotal, order.zoneId)}`,
    text: [
      `Commande ${order.id} — ${ZONES[order.zoneId].label}`,
      `Client : ${order.customerName} — ${order.customerPhone} — ${order.customerEmail}`,
      `Adresse : ${order.customerAddress}, ${order.customerCity}`,
      "",
      "Articles :",
      itemsText(order),
      "",
      `Sous-total : ${formatPrice(order.subtotal, order.zoneId)}`,
      `État du paiement : en attente (paiement à la livraison ou par WhatsApp, à confirmer manuellement)`,
      "",
      `Voir la commande : ${siteUrl}/admin/commandes/${order.id}`,
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendCustomerOrderConfirmation(
  order: OrderDetail
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();
  const timeoutHours = getPaymentTimeoutHours();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: `Commande ${order.id} bien reçue — AfricAkani`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Votre commande ${order.id} a bien été enregistrée. Merci pour votre confiance !`,
      "",
      "Articles :",
      itemsText(order),
      "",
      `Sous-total : ${formatPrice(order.subtotal, order.zoneId)}`,
      `Livraison : ${order.freeShippingReached ? "gratuite" : "standard"}`,
      "",
      `Merci de confirmer votre paiement (à la livraison ou par WhatsApp) dans les ${timeoutHours} heures. Passé ce délai, la commande sera automatiquement annulée.`,
      "",
      "Nous vous recontacterons pour organiser la livraison.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendCustomerOrderShipped(order: OrderDetail): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: `Votre commande ${order.id} est en route — AfricAkani`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Bonne nouvelle : votre commande ${order.id} vient d'être expédiée.`,
      `Adresse de livraison : ${order.customerAddress}, ${order.customerCity}`,
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendCustomerPaymentReminder(
  order: OrderSummary & { customerEmail: string },
  reminderNumber: 1 | 2
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();
  const timeoutHours = getPaymentTimeoutHours();
  const hoursElapsed = reminderNumber === 1 ? 24 : 48;
  const hoursLeft = Math.max(timeoutHours - hoursElapsed, 0);

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: `Rappel : paiement en attente pour votre commande ${order.id}`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Votre commande ${order.id} (${formatPrice(order.subtotal, order.zoneId)}) est toujours en attente de paiement.`,
      hoursLeft > 0
        ? `Il vous reste environ ${hoursLeft} heures pour confirmer votre paiement (à la livraison ou par WhatsApp), sans quoi la commande sera automatiquement annulée.`
        : `Merci de confirmer votre paiement rapidement, sans quoi la commande sera automatiquement annulée.`,
      "",
      "Répondez à cet e-mail ou contactez-nous sur WhatsApp pour confirmer.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendCustomerOrderCancelled(
  order: OrderSummary & { customerEmail: string }
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: `Commande ${order.id} annulée — paiement non confirmé`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Votre commande ${order.id} a été automatiquement annulée faute de confirmation de paiement dans le délai imparti.`,
      "Vous pouvez repasser commande à tout moment sur notre boutique.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
