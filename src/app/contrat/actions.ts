"use server";

import { createSignedContract, getContractText } from "@/lib/contracts-db";
import { formatEmailError, sendAdminNewContractNotification } from "@/lib/email";

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
  contractId?: string;
}

export async function submitSignedContractAction(
  input: SubmitContractInput
): Promise<SubmitContractResult> {
  const clientName = input.clientName.trim();
  const clientEmail = input.clientEmail.trim();
  const clientPhone = input.clientPhone.trim();
  const projectDescription = input.projectDescription.trim();

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

  const contract = await createSignedContract({
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

  try {
    await sendAdminNewContractNotification(contract);
  } catch (err) {
    console.error(`[email] Contrat ${contract.id} : ${formatEmailError(err)}`);
  }

  return { ok: true, contractId: contract.id };
}
