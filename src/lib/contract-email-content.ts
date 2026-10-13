// Wording of the two e-mails sent when a contract is signed. Pure (no Resend,
// no database): unit-tested, and turned into text + HTML by renderEmailHtml.

import type { SignedContract } from "./contracts-db";

export interface ContractEmailContent {
  subject: string;
  lines: string[];
}

/** "13 octobre 2026 à 14:32", in Cotonou time — the same clock the team works on. */
export function formatContractDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(iso));
}

export function contractPdfFilename(contract: Pick<SignedContract, "id">): string {
  return `contrat-${contract.id}.pdf`;
}

/** To the administrator: who signed, when, which reference, and where to open it.
 *  The contract itself is deliberately NOT attached (it holds a signature and
 *  personal data; it stays behind the admin login). */
export function buildAdminContractEmail(
  contract: SignedContract,
  siteUrl: string
): ContractEmailContent {
  const lines = [
    `Un nouveau contrat vient d'être signé électroniquement.`,
    "",
    `Client : ${contract.clientName}`,
    contract.companyName ? `Entreprise : ${contract.companyName}` : null,
    `Date de signature : ${formatContractDate(contract.createdAt)} (heure de Cotonou)`,
    `Référence du contrat : ${contract.id}`,
    "",
    `Contact : ${contract.clientPhone} — ${contract.clientEmail}`,
    `Service(s) : ${contract.services.join(", ") || "—"}`,
    contract.budget ? `Budget estimé : ${contract.budget}` : null,
    contract.timeline ? `Délai souhaité : ${contract.timeline}` : null,
    "",
    "Description du besoin :",
    contract.projectDescription || "—",
    "",
    `Ouvrir dans l'admin (connexion requise) : ${siteUrl}/admin/contrats`,
    "Le contrat n'est pas joint à ce message : téléchargez-le en PDF depuis l'admin.",
  ].filter((line): line is string => line !== null);

  return {
    subject: `Nouveau contrat signé : ${contract.id} — ${contract.clientName}`,
    lines,
  };
}

/** To the client: confirmation that their signed contract was received; the PDF copy is attached. */
export function buildClientContractEmail(contract: SignedContract): ContractEmailContent {
  const firstName = contract.clientName.trim().split(/\s+/)[0] ?? "";
  const lines = [
    `Bonjour${firstName ? ` ${firstName}` : ""},`,
    "",
    `Nous avons bien reçu votre contrat de prestation de services, signé électroniquement le ${formatContractDate(contract.createdAt)}.`,
    `Référence du contrat : ${contract.id}`,
    contract.services.length > 0 ? `Service(s) : ${contract.services.join(", ")}` : null,
    "",
    `Vous trouverez en pièce jointe une copie de votre contrat au format PDF (${contractPdfFilename(contract)}). Conservez-la précieusement.`,
    "",
    "Notre équipe vous recontactera prochainement au sujet de votre projet. Pour toute question, répondez simplement à cet e-mail.",
    "",
    "L'équipe AfricAkani",
  ].filter((line): line is string => line !== null);

  return {
    subject: `Votre contrat ${contract.id} est bien enregistré — copie PDF jointe`,
    lines,
  };
}
