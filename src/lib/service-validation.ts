// Checks on what an admin or a client types into the service-payment forms. Pure
// (no database): every function returns either the clean value or a French error.
// The server runs these on every submission, whatever the browser did.

import {
  DEFAULT_DEPOSIT,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  adjustmentAmountError,
  isValidInstallmentCount,
  type AdjustmentKind,
} from "./service-account-math";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT = 100_000_000;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseWholeAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\s  ]/g, "");
  if (!/^-?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

/** A real calendar date written YYYY-MM-DD. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Adds whole months to a YYYY-MM-DD date (day clamped to the end of a short month). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

// ---- New payment file -----------------------------------------------------------------------

export interface NewAccountInput {
  merchantName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  contractId: string | null;
  total: number;
  deposit: number;
  installments: { label: string; dueDate: string }[];
  goLiveDate: string | null;
  followupAmount: number;
  followupPeriod: "month" | "quarter";
  note: string;
}

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}$/;

/** The client's contact details, where the receipts go. The e-mail is optional but must be valid when given. */
export function parseClientContact(raw: {
  clientName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
}): Parsed<{ clientName: string; clientEmail: string; clientPhone: string }> {
  const clientEmail = text(raw.clientEmail, 160).toLowerCase();
  if (clientEmail && !EMAIL_PATTERN.test(clientEmail)) {
    return { ok: false, error: "L'adresse e-mail du client n'est pas valide." };
  }
  const clientPhone = text(raw.clientPhone, 30);
  if (clientPhone && !/^\+?[0-9][0-9 .\-]{5,24}$/.test(clientPhone)) {
    return { ok: false, error: "Le numéro de téléphone du client n'est pas valide (chiffres, espaces, +)." };
  }
  return { ok: true, value: { clientName: text(raw.clientName, 120), clientEmail, clientPhone } };
}

export function parseNewAccountInput(raw: {
  clientName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  merchantName?: unknown;
  contractId?: unknown;
  total?: unknown;
  deposit?: unknown;
  installmentCount?: unknown;
  labels?: unknown[];
  dates?: unknown[];
  goLiveDate?: unknown;
  followupAmount?: unknown;
  followupPeriod?: unknown;
  note?: unknown;
}): Parsed<NewAccountInput> {
  const merchantName = text(raw.merchantName, 120);
  if (!merchantName) return { ok: false, error: "Indiquez le nom du marchand." };
  const contact = parseClientContact(raw);
  if (!contact.ok) return contact;

  const total = parseWholeAmount(raw.total);
  if (total === null || total < 1 || total > MAX_AMOUNT) {
    return { ok: false, error: "Le prix total doit être un nombre entier de FCFA, supérieur à 0." };
  }
  const deposit = raw.deposit === undefined || raw.deposit === "" ? DEFAULT_DEPOSIT : parseWholeAmount(raw.deposit);
  if (deposit === null || deposit < 0 || deposit > total) {
    return { ok: false, error: "L'acompte doit être un nombre entier de FCFA, entre 0 et le prix total." };
  }

  const count = parseWholeAmount(raw.installmentCount);
  if (count === null || !isValidInstallmentCount(count)) {
    return { ok: false, error: `Choisissez ${MIN_INSTALLMENTS}, 3 ou ${MAX_INSTALLMENTS} tranches.` };
  }
  const installments: { label: string; dueDate: string }[] = [];
  for (let i = 0; i < count; i++) {
    const dueDate = raw.dates?.[i];
    if (!isValidIsoDate(dueDate)) {
      return { ok: false, error: `Indiquez la date de la tranche ${i + 1} (jour, mois, année).` };
    }
    installments.push({ label: text(raw.labels?.[i], 80), dueDate });
  }
  for (let i = 1; i < installments.length; i++) {
    if (installments[i].dueDate < installments[i - 1].dueDate) {
      return { ok: false, error: "Les dates des tranches doivent se suivre dans l'ordre." };
    }
  }

  const goLive = raw.goLiveDate === undefined || raw.goLiveDate === "" ? null : raw.goLiveDate;
  if (goLive !== null && !isValidIsoDate(goLive)) {
    return { ok: false, error: "La date de mise en ligne n'est pas valide." };
  }

  const followupAmount =
    raw.followupAmount === undefined || raw.followupAmount === "" ? 3000 : parseWholeAmount(raw.followupAmount);
  if (followupAmount === null || followupAmount < 0 || followupAmount > MAX_AMOUNT) {
    return { ok: false, error: "La mensualité de suivi doit être un nombre entier de FCFA." };
  }
  const followupPeriod = raw.followupPeriod === "quarter" ? "quarter" : "month";

  return {
    ok: true,
    value: {
      merchantName,
      ...contact.value,
      contractId: text(raw.contractId, 60) || null,
      total,
      deposit,
      installments,
      goLiveDate: goLive,
      followupAmount,
      followupPeriod,
      note: text(raw.note, 500),
    },
  };
}

// ---- A Mobile Money payment (typed by the client, or recorded by the admin) ------------------

export interface MobileMoneySubmission {
  operatorId: string;
  phone: string;
  transactionId: string;
  amount: number;
}

export function parseMobileMoneySubmission(raw: {
  operatorId?: unknown;
  phone?: unknown;
  transactionId?: unknown;
  amount?: unknown;
}): Parsed<MobileMoneySubmission> {
  const operatorId = text(raw.operatorId, 60);
  if (!operatorId) return { ok: false, error: "Choisissez votre opérateur Mobile Money." };

  const phone = text(raw.phone, 30);
  if (!/^\+?[0-9][0-9 .\-]{6,19}$/.test(phone) || phone.replace(/\D/g, "").length < 8) {
    return { ok: false, error: "Indiquez votre numéro Mobile Money (chiffres uniquement, au moins 8)." };
  }

  const transactionId = text(raw.transactionId, 60);
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-]{3,59}$/.test(transactionId)) {
    return {
      ok: false,
      error: "Indiquez l'identifiant de transaction reçu par SMS (lettres et chiffres, au moins 4 caractères).",
    };
  }

  const amount = parseWholeAmount(raw.amount);
  if (amount === null || amount < 1 || amount > MAX_AMOUNT) {
    return { ok: false, error: "Indiquez le montant envoyé, en FCFA (nombre entier)." };
  }
  return { ok: true, value: { operatorId, phone, transactionId, amount } };
}

// ---- Payment recorded by the admin ---------------------------------------------------------

export const ADMIN_PAYMENT_METHODS = ["mobile_money", "especes", "virement", "autre"] as const;
export type AdminPaymentMethod = (typeof ADMIN_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  especes: "Espèces",
  virement: "Virement",
  autre: "Autre",
};

export interface AdminPaymentInput {
  amount: number;
  method: AdminPaymentMethod;
  paidOn: string;
  reference: string;
}

export function parseAdminPayment(raw: {
  amount?: unknown;
  method?: unknown;
  paidOn?: unknown;
  reference?: unknown;
}): Parsed<AdminPaymentInput> {
  const amount = parseWholeAmount(raw.amount);
  if (amount === null || amount < 1 || amount > MAX_AMOUNT) {
    return { ok: false, error: "Le montant doit être un nombre entier de FCFA, supérieur à 0." };
  }
  const method = ADMIN_PAYMENT_METHODS.find((m) => m === raw.method);
  if (!method) return { ok: false, error: "Choisissez le moyen de paiement." };
  if (!isValidIsoDate(raw.paidOn)) return { ok: false, error: "Indiquez la date du paiement." };
  return { ok: true, value: { amount, method, paidOn: raw.paidOn, reference: text(raw.reference, 120) } };
}

// ---- Adjustment ------------------------------------------------------------------------------

export function parseAdjustment(raw: {
  kind?: unknown;
  amount?: unknown;
  reason?: unknown;
}): Parsed<{ kind: AdjustmentKind; amount: number; reason: string }> {
  const kind = (["reduction", "correction", "remboursement"] as const).find((k) => k === raw.kind);
  if (!kind) return { ok: false, error: "Choisissez le type d'ajustement." };
  const amount = parseWholeAmount(raw.amount);
  if (amount === null) return { ok: false, error: "Le montant doit être un nombre entier de FCFA." };
  const amountError = adjustmentAmountError(kind, amount);
  if (amountError) return { ok: false, error: amountError };
  const reason = text(raw.reason, 200);
  if (!reason) return { ok: false, error: "Indiquez le motif : il reste visible dans l'historique." };
  return { ok: true, value: { kind, amount, reason } };
}
