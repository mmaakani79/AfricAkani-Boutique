"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-api-auth";
import { getSignedContractById } from "@/lib/contracts-db";
import {
  addServiceAdjustment,
  confirmServicePayment,
  createServiceAccount,
  getServiceAccountFull,
  recordAdminServicePayment,
  regenerateServiceToken,
  rejectServicePayment,
  updateServiceAccountDetails,
  updateServiceInstallments,
} from "@/lib/service-accounts-db";
import { describeReceiptOutcome, sendServiceReceipt } from "@/lib/service-receipts";
import {
  isValidIsoDate,
  parseAdjustment,
  parseClientContact,
  parseAdminPayment,
  parseNewAccountInput,
  parseWholeAmount,
} from "@/lib/service-validation";

export interface ServiceActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface NewServiceAccountState extends ServiceActionState {
  accountId?: string;
  /** The client's private link, shown once (only its fingerprint is stored). */
  link?: string;
}

function refresh(accountId?: string) {
  revalidatePath("/admin/services");
  revalidatePath("/admin");
  if (accountId) revalidatePath(`/admin/services/${accountId}`);
}

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.africakani.com").replace(/\/+$/, "");
}

function privateLink(token: string): string {
  return `${siteOrigin()}/paiement-service/${token}`;
}

export async function createServiceAccountAction(
  _previous: NewServiceAccountState,
  formData: FormData
): Promise<NewServiceAccountState> {
  await requireAdmin();
  const parsed = parseNewAccountInput({
    merchantName: formData.get("merchantName"),
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
    contractId: formData.get("contractId"),
    total: formData.get("total"),
    deposit: formData.get("deposit"),
    installmentCount: formData.get("installmentCount"),
    labels: formData.getAll("label"),
    dates: formData.getAll("date"),
    goLiveDate: formData.get("goLiveDate"),
    followupAmount: formData.get("followupAmount"),
    followupPeriod: formData.get("followupPeriod"),
    note: formData.get("note"),
  });
  if (!parsed.ok) return { error: parsed.error };
  if (parsed.value.contractId && !(await getSignedContractById(parsed.value.contractId))) {
    return { error: "Ce contrat signé est introuvable." };
  }
  const { id, token } = await createServiceAccount(parsed.value);
  refresh(id);
  return { ok: true, accountId: id, link: privateLink(token) };
}

export async function recordPaymentAction(
  accountId: string,
  _previous: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  await requireAdmin();
  const parsed = parseAdminPayment({
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidOn: formData.get("paidOn"),
    reference: formData.get("reference"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const payment = await recordAdminServicePayment(accountId, parsed.value);
  if (!payment) return { error: "Dossier introuvable." };
  // "Envoyer le reçu" is ticked by default; the receipt never blocks the recording.
  const sendReceipt = formData.get("sendReceipt") === "yes";
  const receiptMessage = sendReceipt
    ? ` ${describeReceiptOutcome(await sendServiceReceipt(accountId, payment.id))}`
    : " Aucun reçu envoyé (case décochée).";
  refresh(accountId);
  return { ok: true, message: `Paiement enregistré et confirmé.${receiptMessage}` };
}

export async function confirmPaymentAction(
  accountId: string,
  paymentId: string
): Promise<ServiceActionState> {
  await requireAdmin();
  const payment = await confirmServicePayment(paymentId);
  if (!payment || payment.accountId !== accountId) {
    return { error: "Ce paiement n'est plus en attente (déjà confirmé ou rejeté)." };
  }
  // The receipt leaves as soon as the payment is confirmed; a failure is shown, never blocks.
  const outcome = await sendServiceReceipt(accountId, paymentId);
  refresh(accountId);
  return { ok: true, message: `Paiement confirmé. ${describeReceiptOutcome(outcome)}` };
}

export async function rejectPaymentAction(
  accountId: string,
  paymentId: string,
  _previous: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!reason) return { error: "Indiquez le motif du rejet : le client le verra." };
  const payment = await rejectServicePayment(paymentId, reason);
  if (!payment || payment.accountId !== accountId) {
    return { error: "Ce paiement n'est plus en attente (déjà confirmé ou rejeté)." };
  }
  refresh(accountId);
  return { ok: true, message: "Paiement rejeté." };
}

export async function addAdjustmentAction(
  accountId: string,
  _previous: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  await requireAdmin();
  const parsed = parseAdjustment({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const adjustment = await addServiceAdjustment(accountId, parsed.value);
  if (!adjustment) return { error: "Dossier introuvable." };
  refresh(accountId);
  return { ok: true, message: "Ajustement ajouté à l'historique." };
}

export async function updateInstallmentsAction(
  accountId: string,
  _previous: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  await requireAdmin();
  const labels = formData.getAll("label").map((v) => String(v).trim().slice(0, 80));
  const dates = formData.getAll("date").map(String);
  if (dates.some((d) => !isValidIsoDate(d))) return { error: "Chaque tranche doit avoir une date valide." };
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) return { error: "Les dates des tranches doivent se suivre dans l'ordre." };
  }
  const ok = await updateServiceInstallments(
    accountId,
    dates.map((dueDate, i) => ({ label: labels[i] ?? "", dueDate }))
  );
  if (!ok) return { error: "Le nombre de tranches ne peut pas être changé ici." };
  refresh(accountId);
  return { ok: true, message: "Échéances enregistrées." };
}

export async function updateDetailsAction(
  accountId: string,
  _previous: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  await requireAdmin();
  const goLiveRaw = String(formData.get("goLiveDate") ?? "");
  if (goLiveRaw && !isValidIsoDate(goLiveRaw)) return { error: "La date de mise en ligne n'est pas valide." };
  const followupAmount = parseWholeAmount(formData.get("followupAmount"));
  if (followupAmount === null || followupAmount < 0) return { error: "La mensualité de suivi doit être un nombre entier de FCFA." };
  const contact = parseClientContact({
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
  });
  if (!contact.ok) return { error: contact.error };
  const ok = await updateServiceAccountDetails(accountId, {
    ...contact.value,
    goLiveDate: goLiveRaw || null,
    note: String(formData.get("note") ?? "").trim().slice(0, 500),
    followupAmount,
    followupPeriod: formData.get("followupPeriod") === "quarter" ? "quarter" : "month",
  });
  if (!ok) return { error: "Dossier introuvable." };
  refresh(accountId);
  return { ok: true, message: "Informations enregistrées." };
}

export interface RegenerateLinkState extends ServiceActionState {
  link?: string;
}

export async function regenerateLinkAction(
  accountId: string,
  _previous: RegenerateLinkState,
  formData: FormData
): Promise<RegenerateLinkState> {
  await requireAdmin();
  if (formData.get("confirm") !== "yes") return { error: "Cochez la case pour confirmer : l'ancien lien cessera de fonctionner." };
  if (!(await getServiceAccountFull(accountId))) return { error: "Dossier introuvable." };
  const token = await regenerateServiceToken(accountId);
  if (!token) return { error: "Dossier introuvable." };
  refresh(accountId);
  return { ok: true, link: privateLink(token), message: "Nouveau lien créé. L'ancien ne fonctionne plus." };
}

/** Sends a payment's receipt again (or for the first time, if it could not leave). */
export async function resendReceiptAction(
  accountId: string,
  paymentId: string
): Promise<ServiceActionState> {
  await requireAdmin();
  const full = await getServiceAccountFull(accountId);
  if (!full?.payments.some((p) => p.id === paymentId && p.status === "confirme")) {
    return { error: "Seul un paiement confirmé a un reçu." };
  }
  const outcome = await sendServiceReceipt(accountId, paymentId, { force: true });
  refresh(accountId);
  return outcome.status === "sent"
    ? { ok: true, message: describeReceiptOutcome(outcome) }
    : { error: describeReceiptOutcome(outcome) };
}
