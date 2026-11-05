import { getDeploymentEnv } from "./deployment-env";
import { formatEmailError, sendServicePaymentReceipt } from "./email";
import { getAdminNotifyEmail } from "./order-config";
import {
  claimServiceReceipt,
  getServiceAccountFull,
  markServiceReceiptFailed,
  markServiceReceiptSent,
  type ServiceAccountFull,
} from "./service-accounts-db";
import { computeAccountState, todayInBenin } from "./service-account-math";
import {
  SERVICE_REPLY_TO,
  buildServiceReceipt,
  isDepositReceipt,
  receiptRecipient,
  type BuiltReceipt,
} from "./service-receipt";

/** The receipt of one confirmed payment, with the file as it stood when that payment was confirmed
 *  (later payments and adjustments are not counted), so a receipt sent again says the same thing. */
export function buildReceiptForPayment(full: ServiceAccountFull, paymentId: string): BuiltReceipt | null {
  const payment = full.payments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== "confirme" || !payment.confirmedAt) return null;
  const at = payment.confirmedAt;
  const asOfPayments = full.payments.filter((p) => p.status !== "confirme" || (p.confirmedAt ?? "") <= at);
  const asOfAdjustments = full.adjustments.filter((a) => a.createdAt <= at);
  const state = computeAccountState({
    total: full.account.total,
    deposit: full.account.deposit,
    installments: full.installments,
    payments: asOfPayments,
    adjustments: asOfAdjustments,
    today: todayInBenin(),
  });
  // The deposit rules go with the PLANNED deposit of the file (first line of its schedule), not with "the first payment".
  const depositPlanned = state.schedule.find((l) => l.kind === "deposit")?.amount ?? 0;
  const asOfRefunds = asOfAdjustments.filter((a) => a.kind === "remboursement").map((a) => ({ amount: a.amount, at: a.createdAt }));
  return buildServiceReceipt({
    merchantName: full.account.merchantName,
    clientName: full.account.clientName,
    payment,
    state,
    deposit: isDepositReceipt(asOfPayments, paymentId, depositPlanned, asOfRefunds),
    asOf: todayInBenin(Date.parse(at)),
  });
}

export type ReceiptOutcome =
  | { status: "sent"; to: string; test: boolean }
  | { status: "skipped" }
  | { status: "no_email" }
  | { status: "failed"; error: string };

/**
 * Sends the receipt of a CONFIRMED payment by e-mail. Never throws: a receipt that cannot leave
 * must not undo the confirmation. The state (sent / reason of the failure) is kept on the payment
 * and shown in the admin, with a "resend" button; `force` resends an already sent receipt.
 */
export async function sendServiceReceipt(
  accountId: string,
  paymentId: string,
  options: { force?: boolean } = {}
): Promise<ReceiptOutcome> {
  try {
    const full = await getServiceAccountFull(accountId);
    const payment = full?.payments.find((p) => p.id === paymentId);
    if (!full || !payment || payment.status !== "confirme") return { status: "skipped" };

    if (!full.account.clientEmail) {
      await markServiceReceiptFailed(
        paymentId,
        accountId,
        "Aucune adresse e-mail pour ce client : ajoutez-la dans « Informations du dossier », puis renvoyez le reçu."
      );
      return { status: "no_email" };
    }
    if (!(await claimServiceReceipt(paymentId, options.force === true))) return { status: "skipped" };

    const receipt = buildReceiptForPayment(full, paymentId);
    if (!receipt) return { status: "skipped" };
    const { to, testNotice } = receiptRecipient({
      deploymentEnv: getDeploymentEnv(),
      clientEmail: full.account.clientEmail,
      adminEmail: getAdminNotifyEmail(),
    });
    try {
      await sendServicePaymentReceipt({
        to,
        replyTo: SERVICE_REPLY_TO,
        subject: testNotice.length > 0 ? `[TEST] ${receipt.subject}` : receipt.subject,
        lines: [...testNotice, ...receipt.lines],
        closing: receipt.closing,
      });
    } catch (err) {
      const error = formatEmailError(err);
      console.error(`[services] Reçu ${paymentId} non envoyé : ${error}`);
      await markServiceReceiptFailed(paymentId, accountId, error);
      return { status: "failed", error };
    }
    await markServiceReceiptSent(paymentId, accountId, to);
    return { status: "sent", to, test: testNotice.length > 0 };
  } catch (err) {
    const error = formatEmailError(err);
    console.error(`[services] Reçu ${paymentId} : erreur inattendue : ${error}`);
    return { status: "failed", error };
  }
}

export function describeReceiptOutcome(outcome: ReceiptOutcome): string {
  switch (outcome.status) {
    case "sent":
      return outcome.test
        ? `Reçu envoyé à votre adresse (test : en production il part au client).`
        : "Reçu envoyé au client.";
    case "no_email":
      return "Le reçu n'a pas pu partir : aucune adresse e-mail pour ce client.";
    case "failed":
      return `Le reçu n'a pas pu partir (${outcome.error}). Vous pouvez le renvoyer.`;
    case "skipped":
      return "Le reçu a déjà été envoyé ou part en ce moment.";
  }
}
