"use server";

import { requireAdmin } from "@/lib/admin-api-auth";

import { redirect } from "next/navigation";
import {
  createPackagingType,
  updatePackagingType,
  deletePackagingType,
  PackagingTypeInUseError,
  type PackagingTypeInput,
} from "@/lib/packaging-types-db";
import type { ActionState } from "../../actions";

function readPackagingTypeForm(formData: FormData): PackagingTypeInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
  };
}

export async function createPackagingTypeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const input = readPackagingTypeForm(formData);

  if (!input.name) {
    return { error: "Le nom du type d'emballage est obligatoire." };
  }

  try {
    await createPackagingType(input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "Un type d'emballage avec ce nom existe déjà." };
    }
    return { error: "Erreur lors de la création du type d'emballage." };
  }

  redirect("/admin/emballages");
}

export async function updatePackagingTypeAction(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const input = readPackagingTypeForm(formData);

  if (!input.name) {
    return { error: "Le nom du type d'emballage est obligatoire." };
  }

  try {
    const updated = await updatePackagingType(id, input);
    if (!updated) return { error: "Type d'emballage introuvable." };
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "Un type d'emballage avec ce nom existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour du type d'emballage." };
  }

  redirect("/admin/emballages");
}

export interface DeletePackagingTypeState {
  error?: string;
}

export async function deletePackagingTypeAction(
  id: string
): Promise<DeletePackagingTypeState> {
  await requireAdmin();
  try {
    await deletePackagingType(id);
  } catch (err) {
    if (err instanceof PackagingTypeInUseError) {
      return { error: err.message };
    }
    return { error: "Erreur lors de la suppression du type d'emballage." };
  }

  redirect("/admin/emballages");
}
