"use server";

import { revalidatePath } from "next/cache";
import { getServiceAccountByToken, setServicePaymentEmailResult, submitClientMobileMoneyPayment } from "@/lib/service-accounts-db";
import { parseMobileMoneySubmission } from "@/lib/service-validation";
import { formatEmailError, sendAdminServicePaymentSubmitted } from "@/lib/email";
import { fcfa } from "@/lib/service-format";

export interface ServicePaymentFormState {
  ok?: boolean;
  message?: string;
  error?: string;
}

/** The client's Mobile Money payment, typed on their private page. The secret link is
 *  bound to the action (never put in the form); every rule is checked again here. */
export async function submitServicePaymentAction(
  token: string,
  _previous: ServicePaymentFormState,
  formData: FormData
): Promise<ServicePaymentFormState> {
  const full = await getServiceAccountByToken(token);
  if (!full) return { error: "Ce lien n'est plus valide. Demandez-en un nouveau à AkaGest." };

  const parsed = parseMobileMoneySubmission({
    operatorId: formData.get("operatorId"),
    phone: formData.get("phone"),
    transactionId: formData.get("transactionId"),
    amount: formData.get("amount"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const result = await submitClientMobileMoneyPayment(full.account.id, parsed.value);
  if (!result.ok) return { error: result.error };

  // Tell the admin right away. A failed e-mail never loses the payment: it stays "soumis" in the
  // admin dashboard, with the reason noted on the payment.
  try {
    await sendAdminServicePaymentSubmitted({
      accountId: full.account.id,
      merchantName: full.account.merchantName,
      paymentId: result.payment.id,
      amount: result.payment.amount,
      operator: result.payment.mmOperator,
      phone: result.payment.mmPhone,
      transactionId: result.payment.mmTransactionId,
      remainingAfter: full.state.remaining - result.payment.amount,
    });
    await setServicePaymentEmailResult(result.payment.id, null);
  } catch (err) {
    const message = formatEmailError(err);
    console.error(`[services] Paiement ${result.payment.id} : e-mail à l'administrateur non envoyé : ${message}`);
    await setServicePaymentEmailResult(result.payment.id, message.slice(0, 300)).catch(() => {});
  }

  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${full.account.id}`);
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Merci ! Votre paiement de ${fcfa(result.payment.amount)} est enregistré. Nous le vérifions et le confirmons sous 30 minutes en général, et au plus tard sous 2 heures.`,
  };
}
