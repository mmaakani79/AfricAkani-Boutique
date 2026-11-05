// The receipt a client gets when AkaGest confirms one of their payments (e-mail and a WhatsApp
// message). Pure: builds the texts only, no sending. The wording is the owner's, validated
// before coding (see the conversation of lot 1):
//  - the deposit receipt recalls the deposit refund rules;
//  - every later receipt only says "Conditions de remboursement : celles de votre contrat signé.";
//  - the private tracking link is never written in a receipt (only its fingerprint is stored).

import type { AccountState, NextDue } from "./service-account-math";
import { dateFr, fcfa } from "./service-format";
import { withReceiptSloganText } from "./receipt-slogan";
import { PAYMENT_METHOD_LABELS } from "./service-validation";

/** Where a client's replies to a receipt go. The message itself is sent from the shop's domain. */
export const SERVICE_REPLY_TO = "contact@akagest.com";

export const PROVIDER_LINE = "Service fourni par AkaGest.";
export const CONTRACT_REFUND_LINE = "Conditions de remboursement : celles de votre contrat signé.";
export const TRACKING_LINK_LINE =
  "Votre lien de suivi vous a été envoyé par WhatsApp. En cas de perte, demandez-en un nouveau.";
export const DEPOSIT_REFUND_LINES = [
  "L'acompte est remboursé seulement si AkaGest ne livre pas le service.",
  "L'acompte est gardé par AkaGest si le client abandonne le projet.",
  "Les règles de retour et de remboursement de la boutique de produits AfricAkani ne s'appliquent pas à ce service.",
];

export interface ReceiptPayment {
  id: string;
  amount: number;
  method: string;
  mmOperator: string | null;
  /** YYYY-MM-DD */
  paidOn: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

/** A refund recorded on the file (an adjustment of kind "remboursement"): `at` is the ISO instant it was recorded. */
export interface DepositRefund {
  amount: number;
  at: string;
}

/**
 * The payments that make up the PLANNED DEPOSIT of the file. Confirmed payments are applied in the order
 * they were confirmed, exactly like the schedule does: a payment belongs to the deposit while what the
 * client has paid before it (refunds taken off) is still below the planned deposit. So the receipt of a
 * payment carries the deposit rules only when that payment pays (part of) the deposit; with a planned
 * deposit of 0 no receipt does. Every other receipt only refers to the signed contract.
 *
 *  - exactly the deposit (5 000): that payment; the next one is a normal payment;
 *  - below (4 999): that payment, and the next one that completes the deposit;
 *  - above (5 001, or a whole tranche): one payment, which pays the deposit first and the rest on the tranches;
 *  - a deposit that was refunded is owed again: the payment that pays it again carries the rules again.
 */
export function depositPaymentIds(
  payments: ReceiptPayment[],
  depositPlanned: number,
  refunds: DepositRefund[] = []
): Set<string> {
  const ids = new Set<string>();
  type Step = { at: string; created: string; payment: ReceiptPayment | null; refund: number };
  const steps: Step[] = [
    ...payments
      .filter((p) => p.confirmedAt)
      .map((p) => ({ at: p.confirmedAt as string, created: p.createdAt, payment: p, refund: 0 })),
    ...refunds.map((r) => ({ at: r.at, created: r.at, payment: null, refund: r.amount })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.payment ? 0 : 1) - (b.payment ? 0 : 1) || a.created.localeCompare(b.created));
  let paid = 0;
  for (const step of steps) {
    if (!step.payment) {
      paid = Math.max(0, paid - step.refund);
      continue;
    }
    if (paid < depositPlanned) ids.add(step.payment.id);
    paid += step.payment.amount;
  }
  return ids;
}

/** True when the receipt of `paymentId` carries the deposit refund rules (see `depositPaymentIds`). */
export function isDepositReceipt(
  payments: ReceiptPayment[],
  paymentId: string,
  depositPlanned: number,
  refunds: DepositRefund[] = []
): boolean {
  return depositPaymentIds(payments, depositPlanned, refunds).has(paymentId);
}

/** A due date already behind the day the receipt is issued is not shown as a date: it is overdue. */
export const OVERDUE_TEXT = "échéance dépassée";

function nextDueText(next: NextDue | null, asOf: string): string {
  if (!next) return "Votre dossier est soldé. Merci !";
  const what = next.kind === "deposit" ? "Acompte" : next.label || `Tranche ${next.position}`;
  const when = next.dueDate ? ` — ${next.dueDate < asOf ? OVERDUE_TEXT : dateFr(next.dueDate)}` : "";
  return `Prochaine échéance : ${what}${when} — ${fcfa(next.amount)}`;
}

function methodText(payment: ReceiptPayment): string {
  const base = PAYMENT_METHOD_LABELS[payment.method] ?? payment.method;
  return payment.mmOperator ? `${base} (${payment.mmOperator})` : base;
}

export interface BuiltReceipt {
  subject: string;
  /** Plain-text lines of the receipt detail (a "" is a blank line): left-aligned, also the source of the HTML version. */
  lines: string[];
  /** The concluding block right before the slogan (provider, refund terms, tracking sentence): centered. */
  closing: string[];
  whatsappText: string;
}

export function buildServiceReceipt(input: {
  merchantName: string;
  clientName: string;
  payment: ReceiptPayment;
  state: Pick<AccountState, "adjustedTotal" | "paid" | "remaining" | "reductions" | "next">;
  deposit: boolean;
  /** YYYY-MM-DD: the day the receipt is issued, to tell an overdue due date from a coming one. Default: the day of the payment. */
  asOf?: string;
}): BuiltReceipt {
  const { merchantName, payment, state, deposit } = input;
  const who = input.clientName.trim() || merchantName;
  const date = dateFr(payment.paidOn ?? payment.confirmedAt?.slice(0, 10) ?? payment.createdAt.slice(0, 10));
  const asOf = input.asOf ?? payment.confirmedAt?.slice(0, 10) ?? payment.createdAt.slice(0, 10);
  const subject = `Reçu de paiement — ${merchantName} — ${fcfa(payment.amount)}`;

  const lines = [
    `Bonjour ${who},`,
    "",
    deposit ? "Nous avons bien reçu votre acompte. Merci !" : "Nous avons bien reçu votre paiement. Merci !",
    "",
    `Reçu n° ${payment.id}`,
    `Marchand : ${merchantName}`,
    `Montant payé : ${fcfa(payment.amount)}`,
    `Date : ${date}`,
    `Moyen : ${methodText(payment)}`,
    "",
    "Situation de votre dossier",
    state.reductions > 0 ? `Prix total (après réductions) : ${fcfa(state.adjustedTotal)}` : `Prix total : ${fcfa(state.adjustedTotal)}`,
    `Déjà payé : ${fcfa(Math.max(0, state.paid))}`,
    `Reste à payer : ${fcfa(state.remaining)}`,
    nextDueText(state.next, asOf),
  ];

  const closing = [
    PROVIDER_LINE,
    "",
    ...(deposit ? ["Remboursement de l'acompte", ...DEPOSIT_REFUND_LINES.map((l) => `• ${l}`)] : [CONTRACT_REFUND_LINE]),
    "",
    TRACKING_LINK_LINE,
    "Pour toute question, répondez à ce message.",
  ];

  const next = state.next
    ? `Prochaine échéance : ${state.next.kind === "deposit" ? "acompte" : state.next.label || `tranche ${state.next.position}`}${state.next.dueDate ? `, ${state.next.dueDate < asOf ? OVERDUE_TEXT : dateFr(state.next.dueDate)}` : ""}, ${fcfa(state.next.amount)}.`
    : "Votre dossier est soldé. Merci !";
  const whatsappText = [
    `Bonjour ${who.split(" ")[0] || who}, AkaGest a bien reçu ${deposit ? "votre acompte" : "votre paiement"} de ${fcfa(payment.amount)} le ${date} (reçu ${payment.id}).`,
    `Reste à payer : ${fcfa(state.remaining)}. ${next}`,
    PROVIDER_LINE,
    deposit
      ? "Acompte remboursé seulement si AkaGest ne livre pas ; gardé si le client abandonne le projet."
      : CONTRACT_REFUND_LINE,
    "Merci !",
  ].join(" ");
  const whatsappWithSlogan = withReceiptSloganText(whatsappText);

  return { subject, lines, closing, whatsappText: whatsappWithSlogan };
}

/** "https://wa.me/<number>?text=…" for the receipt, or null when the client has no usable number. */
export function receiptWhatsappHref(clientPhone: string, whatsappText: string): string | null {
  const digits = clientPhone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappText)}`;
}

/** Where a receipt goes. On a Vercel Preview it NEVER goes to the client: it goes to the owner's own
 *  address, marked as a test, so trying the Preview cannot e-mail a real client. */
export function receiptRecipient(input: {
  deploymentEnv: "production" | "preview" | "local";
  clientEmail: string;
  adminEmail: string;
}): { to: string; testNotice: string[] } {
  if (input.deploymentEnv === "preview") {
    return {
      to: input.adminEmail,
      testNotice: [
        "[TEST — prévisualisation] Ce reçu n'a PAS été envoyé au client.",
        `En production, il serait envoyé à : ${input.clientEmail}`,
        "",
      ],
    };
  }
  return { to: input.clientEmail, testNotice: [] };
}
