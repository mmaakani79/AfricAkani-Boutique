"use server";

import { revalidatePath } from "next/cache";
import { setContractText, deleteSignedContract } from "@/lib/contracts-db";

export interface ContractTextState {
  error?: string;
  saved?: boolean;
}

export async function updateContractTextAction(
  _prevState: ContractTextState,
  formData: FormData
): Promise<ContractTextState> {
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
  await deleteSignedContract(id);
  revalidatePath("/admin/contrats");
}
