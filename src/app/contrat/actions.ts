"use server";

import { createSignedContract, getContractText } from "@/lib/contracts-db";
import { notifyContractSigned, resendContractEmails } from "@/lib/contract-notifications";
import { CONTRACT_EMAIL_TARGETS } from "@/lib/contract-email-delivery";
import { isValidContractId } from "@/lib/contract-types";

export interface SubmitContractInput {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  services: string[];
  projectDescription: string;
  budget: string;
  timeline: string;
  notes: string;
  signatureDataUrl: string;
}

export interface SubmitContractResult {
  ok: boolean;
  error?: string;
  /** "bad_id": the form must start again with a fresh reference. */
  code?: "bad_id";
  contractId?: string;
  /** True when the PDF copy has just been e-mailed to the client. */
  clientCopySent?: boolean;
}

export async function submitSignedContractAction(
  input: SubmitContractInput
): Promise<SubmitContractResult> {
  const clientName = input.clientName.trim();
  const clientEmail = input.clientEmail.trim();
  const clientPhone = input.clientPhone.trim();
  const projectDescription = input.projectDescription.trim();

  if (!isValidContractId(input.id)) {
    return {
      ok: false,
      code: "bad_id",
      error: "Référence de contrat invalide. Merci de recharger la page et de réessayer.",
    };
  }
  if (!clientName || !clientEmail || !clientPhone || !projectDescription) {
    return { ok: false, error: "Merci de compléter tous les champs obligatoires." };
  }
  if (input.services.length === 0) {
    return { ok: false, error: "Merci de sélectionner au moins un service." };
  }
  if (!input.signatureDataUrl.startsWith("data:image/png;base64,")) {
    return { ok: false, error: "Merci de signer avant d'envoyer le contrat." };
  }

  // The text the client actually agreed to — frozen at signing time so a
  // later edit to the template never rewrites what was already signed.
  const contractTextSnapshot = await getContractText();

  // Idempotent on the reference: a double click or a reload that sends the
  // same reference again stores nothing more and sends no e-mail again.
  const { contract, created } = await createSignedContract({
    id: input.id,
    clientName,
    clientEmail,
    clientPhone,
    companyName: input.companyName.trim(),
    services: input.services,
    projectDescription,
    budget: input.budget.trim(),
    timeline: input.timeline.trim(),
    notes: input.notes.trim(),
    contractTextSnapshot,
    signatureDataUrl: input.signatureDataUrl,
  });

  if (!created) {
    // Same reference but another person's details: never present someone else's
    // contract as the client's own.
    if (contract.clientEmail !== clientEmail || contract.clientName !== clientName) {
      return {
        ok: false,
        code: "bad_id",
        error: "Référence de contrat déjà utilisée. Merci de recharger la page et de réessayer.",
      };
    }
    // A first request that stopped before attempting an e-mail leaves nothing
    // recorded: complete exactly those. Anything already sent, in flight or
    // failed is left alone (a failure is resent from the admin, on purpose).
    const neverAttempted = CONTRACT_EMAIL_TARGETS.filter((target) => {
      const state = contract.emails[target];
      return state.sentAt === null && state.error === null && state.claimedAt === null;
    });
    if (neverAttempted.length > 0) {
      try {
        await resendContractEmails(contract.id, neverAttempted, false);
      } catch (err) {
        console.error(`[email] Contrat ${contract.id} : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { ok: true, contractId: contract.id };
  }

  // The contract is saved: whatever happens to the e-mails (failure, timeout,
  // provider down) is recorded on it and never blocks the signature.
  let clientCopySent = false;
  try {
    clientCopySent = (await notifyContractSigned(contract.id)).client === "sent";
  } catch (err) {
    console.error(`[email] Contrat ${contract.id} : ${err instanceof Error ? err.message : String(err)}`);
  }

  return { ok: true, contractId: contract.id, clientCopySent };
}
