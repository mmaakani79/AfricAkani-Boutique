"use server";

import { revalidatePath } from "next/cache";
import {
  createOperator,
  deleteOperator,
  setBeneficiaryName,
  updateOperator,
} from "@/lib/mobile-money-db";

export interface MobileMoneyActionState {
  error?: string;
  success?: boolean;
}

export async function updateBeneficiaryNameAction(
  _prevState: MobileMoneyActionState,
  formData: FormData
): Promise<MobileMoneyActionState> {
  const name = String(formData.get("beneficiaryName") ?? "").trim();
  await setBeneficiaryName(name);
  revalidatePath("/admin/reglages");
  return { success: true };
}

export async function createOperatorAction(
  _prevState: MobileMoneyActionState,
  formData: FormData
): Promise<MobileMoneyActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const merchantNumber = String(formData.get("merchantNumber") ?? "").trim();
  if (!name) {
    return { error: "Le nom de l'opérateur est obligatoire." };
  }
  await createOperator({ name, merchantNumber });
  revalidatePath("/admin/reglages");
  return { success: true };
}

export async function updateOperatorAction(
  id: string,
  _prevState: MobileMoneyActionState,
  formData: FormData
): Promise<MobileMoneyActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const merchantNumber = String(formData.get("merchantNumber") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name) {
    return { error: "Le nom de l'opérateur est obligatoire." };
  }
  await updateOperator(id, { name, merchantNumber, active });
  revalidatePath("/admin/reglages");
  return { success: true };
}

export async function deleteOperatorAction(id: string): Promise<void> {
  await deleteOperator(id);
  revalidatePath("/admin/reglages");
}
