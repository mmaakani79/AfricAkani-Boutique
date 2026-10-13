"use server";

import { requireAdmin } from "@/lib/admin-api-auth";

import { revalidatePath } from "next/cache";
import {
  setContractText,
  deleteSignedContract,
  getSignedContractById,
  type ContractEmailTarget,
} from "@/lib/contracts-db";
import { resendContractEmails } from "@/lib/contract-notifications";
import { CONTRACT_EMAIL_TARGETS } from "@/lib/contract-email-delivery";
import { isValidContractId } from "@/lib/contract-types";

export interface ContractTextState {
  error?: string;
  saved?: boolean;
}

export async function updateContractTextAction(
  _prevState: ContractTextState,
  formData: FormData
): Promise<ContractTextState> {
  await requireAdmin();
  const text = String(formData.get("contractText") ?? "").trim();
  if (!text) {
    return { error: "Le texte du contrat ne peut pas être vide." };
  }
  await setContractText(text);
  revalidatePath("/admin/contrats");
  revalidatePath("/contrat");
  return { saved: true };
}

export async function deleteSignedContractAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteSignedContract(id);
  revalidatePath("/admin/contrats");
}

export interface ResendContractEmailResult {
  ok: boolean;
  message: string;
}

const TARGET_LABEL: Record<ContractEmailTarget, string> = {
  admin: "notification à l'administrateur",
  client: "copie au client",
};

/** Resends one of the two e-mails (or both). Pass `force` only after the admin
 *  confirmed re-sending an e-mail that was already delivered. */
export async function resendContractEmailAction(
  id: string,
  target: ContractEmailTarget | "both",
  force: boolean
): Promise<ResendContractEmailResult> {
  await requireAdmin();
  const targets: readonly ContractEmailTarget[] =
    target === "both" ? CONTRACT_EMAIL_TARGETS : CONTRACT_EMAIL_TARGETS.includes(target) ? [target] : [];
  if (!isValidContractId(id) || targets.length === 0) {
    return { ok: false, message: "Demande invalide." };
  }
  if (!(await getSignedContractById(id))) {
    return { ok: false, message: "Contrat introuvable." };
  }

  const result = await resendContractEmails(id, targets, force);
  revalidatePath("/admin/contrats");

  const parts = targets.map((t) => {
    const outcome = result[t];
    if (outcome === "sent") return `${TARGET_LABEL[t]} : envoyée`;
    if (outcome === "skipped") return `${TARGET_LABEL[t]} : déjà envoyée ou envoi en cours (rien de renvoyé)`;
    return `${TARGET_LABEL[t]} : échec (voir le détail ci-dessous)`;
  });
  const ok = targets.every((t) => result[t] === "sent");
  return { ok, message: parts.join(" — ") };
}
