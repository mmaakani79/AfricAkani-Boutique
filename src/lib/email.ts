import { Resend } from "resend";
import type { ProductRequest } from "./product-requests-db";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  return new Resend(apiKey);
}

export async function sendProductRequestNotification(
  request: ProductRequest
): Promise<void> {
  const resend = getClient();
  const to = process.env.NOTIFY_EMAIL || "contact@africakani.com";
  // "onboarding@resend.dev" works with no setup and can send to any
  // recipient; once africakani.com is verified in Resend, set RESEND_FROM
  // to a branded address like "AfricAkani <no-reply@africakani.com>".
  const from = process.env.RESEND_FROM || "AfricAkani <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
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
