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

interface ResendErrorLike {
  name: string;
  message: string;
  statusCode?: number | null;
}

function resendErrorMessage(error: ResendErrorLike): string {
  return `Resend [${error.name}${error.statusCode ? ` ${error.statusCode}` : ""}] : ${error.message}`;
}

/** Turns any thrown value (Error, Resend error, string…) into a plain, loggable message. */
export function formatEmailError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface TestEmailResult {
  ok: boolean;
  detail: string;
}

/** Sends a one-off diagnostic e-mail to the admin address and reports the exact outcome. */
export async function sendTestEmail(): Promise<TestEmailResult> {
  const to = getAdminNotifyEmail();
  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to,
      subject: "Test e-mail AfricAkani",
      text: [
        `Ceci est un e-mail de test envoyé depuis l'admin AfricAkani.`,
        `Horodatage : ${new Date().toLocaleString("fr-FR")}`,
        `Adresse d'expédition (RESEND_FROM) : ${getFrom()}`,
        `Si vous recevez ce message, l'envoi d'e-mails via Resend fonctionne correctement.`,
      ].join("\n"),
    });
    if (error) {
      return { ok: false, detail: resendErrorMessage(error) };
    }
    return {
      ok: true,
      detail: `E-mail envoyé à ${to} (id Resend : ${data?.id ?? "n/a"}).`,
    };
  } catch (err) {
    return { ok: false, detail: formatEmailError(err) };
  }
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
    throw new Error(resendErrorMessage(error));
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

function totalsText(
  order: Pick<OrderDetail, "subtotal" | "shippingFee" | "zoneId">
): string {
  return [
    `Sous-total : ${formatPrice(order.subtotal, order.zoneId)}`,
    `Livraison : ${
      order.shippingFee > 0
        ? formatPrice(order.shippingFee, order.zoneId)
        : "Gratuite"
    }`,
    `Total : ${formatPrice(order.subtotal + order.shippingFee, order.zoneId)}`,
  ].join("\n");
}

export async function sendAdminNewOrderNotification(
  order: OrderDetail
): Promise<void> {
  const resend = getClient();
  const to = getAdminNotifyEmail();
  const siteUrl = getSiteUrl();

  const isMobileMoney = order.paymentMethod === "mobile_money";

  const { error } = await resend.emails.send({
    from: getFrom(),
    to,
    subject: `Nouvelle commande ${order.id} — ${formatPrice(order.subtotal + order.shippingFee, order.zoneId)}`,
    text: [
      `Commande ${order.id} — ${ZONES[order.zoneId].label}`,
      `Client : ${order.customerName} — ${order.customerPhone} — ${order.customerEmail}`,
      `Adresse : ${order.customerAddress}, ${order.customerCity}`,
      "",
      "Articles :",
      itemsText(order),
      "",
      totalsText(order),
      isMobileMoney
        ? [
            "",
            `Paiement : Mobile Money (${order.mobileMoneyOperator}) — en attente de vérification`,
            `Numéro client : ${order.mobileMoneyPhone}`,
            `Identifiant de transaction : ${order.mobileMoneyTransactionId}`,
          ].join("\n")
        : `État du paiement : en attente (à confirmer manuellement par l'admin)`,
      "",
      `Voir la commande : ${siteUrl}/admin/commandes/${order.id}`,
    ].join("\n"),
  });

  if (error) {
    throw new Error(resendErrorMessage(error));
  }
}

export async function sendCustomerOrderConfirmation(
  order: OrderDetail
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();
  const timeoutHours = getPaymentTimeoutHours();
  const isMobileMoney = order.paymentMethod === "mobile_money";

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: isMobileMoney
      ? `Commande ${order.id} reçue — paiement en cours de vérification`
      : `Commande ${order.id} bien reçue — AfricAkani`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Votre commande ${order.id} a bien été enregistrée. Merci pour votre confiance !`,
      "",
      "Articles :",
      itemsText(order),
      "",
      totalsText(order),
      "",
      isMobileMoney
        ? `Nous avons bien reçu votre identifiant de transaction Mobile Money (${order.mobileMoneyTransactionId}). Votre paiement est en cours de vérification — vous recevrez un e-mail dès qu'il sera confirmé.`
        : `Nous vous contacterons par WhatsApp pour finaliser le paiement. Merci de confirmer dans les ${timeoutHours} heures. Passé ce délai, la commande sera automatiquement annulée.`,
      "",
      "Nous vous recontacterons pour organiser la livraison.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(resendErrorMessage(error));
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
    throw new Error(resendErrorMessage(error));
  }
}

export async function sendCustomerPaymentReminder(
  order: OrderSummary & { customerEmail: string; paymentMethod?: string | null },
  reminderNumber: 1 | 2
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();
  const timeoutHours = getPaymentTimeoutHours();
  const hoursElapsed = reminderNumber === 1 ? 24 : 48;
  const hoursLeft = Math.max(timeoutHours - hoursElapsed, 0);
  const isMobileMoney = order.paymentMethod === "mobile_money";

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: isMobileMoney
      ? `Votre paiement Mobile Money est toujours en cours de vérification — commande ${order.id}`
      : `Rappel : paiement en attente pour votre commande ${order.id}`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      isMobileMoney
        ? `Votre commande ${order.id} (${formatPrice(order.subtotal + order.shippingFee, order.zoneId)}) est toujours en cours de vérification.`
        : `Votre commande ${order.id} (${formatPrice(order.subtotal + order.shippingFee, order.zoneId)}) est toujours en attente de paiement.`,
      "",
      totalsText(order),
      "",
      isMobileMoney
        ? hoursLeft > 0
          ? `Nous vérifions votre paiement dès que possible. Si vous n'avez pas encore envoyé le montant, il vous reste environ ${hoursLeft} heures, sans quoi la commande sera automatiquement annulée.`
          : `Nous vérifions votre paiement dès que possible, sans quoi la commande sera automatiquement annulée.`
        : hoursLeft > 0
          ? `Nous vous contacterons par WhatsApp pour finaliser le paiement. Il vous reste environ ${hoursLeft} heures pour confirmer, sans quoi la commande sera automatiquement annulée.`
          : `Nous vous contacterons par WhatsApp pour finaliser le paiement rapidement, sans quoi la commande sera automatiquement annulée.`,
      "",
      "Répondez à cet e-mail ou contactez-nous sur WhatsApp pour toute question.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(resendErrorMessage(error));
  }
}

export async function sendCustomerPaymentConfirmed(
  order: OrderDetail
): Promise<void> {
  if (!order.customerEmail) return;
  const resend = getClient();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: order.customerEmail,
    subject: `Paiement confirmé — commande ${order.id}`,
    text: [
      `Bonjour ${order.customerName.split(" ")[0] || ""},`,
      "",
      `Bonne nouvelle : votre paiement pour la commande ${order.id} a bien été confirmé !`,
      "",
      totalsText(order),
      "",
      "Nous préparons votre commande et vous recontacterons pour organiser la livraison.",
      "",
      "L'équipe AfricAkani",
    ].join("\n"),
  });

  if (error) {
    throw new Error(resendErrorMessage(error));
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
    throw new Error(resendErrorMessage(error));
  }
}
