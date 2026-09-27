"use server";

import { redirect } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryInUseError,
  type CategoryInput,
} from "@/lib/categories-db";
import type { ActionState } from "../../actions";

function readCategoryForm(formData: FormData): CategoryInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    featuredHome: formData.get("featuredHome") === "on",
    photoSeed: String(formData.get("photoSeed") ?? "emerald"),
  };
}

export async function createCategoryAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = readCategoryForm(formData);

  if (!input.name) {
    return { error: "Le nom de la catégorie est obligatoire." };
  }

  try {
    await createCategory(input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "Une catégorie avec ce nom (ou ce slug) existe déjà." };
    }
    return { error: "Erreur lors de la création de la catégorie." };
  }

  redirect("/admin/categories");
}

export async function updateCategoryAction(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = readCategoryForm(formData);

  if (!input.name) {
    return { error: "Le nom de la catégorie est obligatoire." };
  }

  try {
    const updated = await updateCategory(id, input);
    if (!updated) return { error: "Catégorie introuvable." };
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "Une catégorie avec ce nom (ou ce slug) existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour de la catégorie." };
  }

  redirect("/admin/categories");
}

export interface DeleteCategoryState {
  error?: string;
}

export async function deleteCategoryAction(id: string): Promise<DeleteCategoryState> {
  try {
    await deleteCategory(id);
  } catch (err) {
    if (err instanceof CategoryInUseError) {
      return { error: err.message };
    }
    return { error: "Erreur lors de la suppression de la catégorie." };
  }

  redirect("/admin/categories");
}
