"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  checkPassword,
  createSessionToken,
} from "@/lib/admin-auth";
import {
  createProduct,
  deleteProduct,
  slugify,
  updateProduct,
  type ProductInput,
} from "@/lib/products-db";
import type { HalalStatus, PackagingType, StockStatus } from "@/lib/types";

export interface ActionState {
  error?: string;
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");

  let ok: boolean;
  try {
    ok = checkPassword(password);
  } catch {
    return {
      error:
        "ADMIN_PASSWORD n'est pas configuré côté serveur. Ajoutez cette variable d'environnement.",
    };
  }

  if (!ok) {
    return { error: "Mot de passe incorrect." };
  }

  const token = await createSessionToken();
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

function readPrice(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readProductForm(formData: FormData): ProductInput {
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const skuRaw = String(formData.get("sku") ?? "").trim();

  return {
    name,
    slug: slugRaw ? slugify(slugRaw) : slugify(name),
    sku: skuRaw || undefined,
    categoryId: String(formData.get("categoryId") ?? ""),
    halal: String(formData.get("halal") ?? "n/a") as HalalStatus,
    unit: String(formData.get("unit") ?? "").trim(),
    packaging: String(formData.get("packaging") ?? "carton_boite") as PackagingType,
    description: String(formData.get("description") ?? "").trim(),
    prices: {
      bj: readPrice(formData, "priceBj"),
      ca: readPrice(formData, "priceCa"),
      us: readPrice(formData, "priceUs"),
    },
    stock: String(formData.get("stock") ?? "en_stock") as StockStatus,
    featured: formData.get("featured") === "on",
  };
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = readProductForm(formData);

  if (!input.name || !input.slug || !input.categoryId || !input.unit) {
    return { error: "Merci de remplir tous les champs obligatoires." };
  }

  try {
    await createProduct(input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "Un produit avec ce slug existe déjà." };
    }
    return { error: "Erreur lors de la création du produit." };
  }

  redirect("/admin/produits");
}

export async function updateProductAction(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const input = readProductForm(formData);

  if (!input.name || !input.slug || !input.categoryId || !input.unit) {
    return { error: "Merci de remplir tous les champs obligatoires." };
  }

  try {
    const updated = await updateProduct(id, input);
    if (!updated) return { error: "Produit introuvable." };
  } catch {
    return { error: "Erreur lors de la mise à jour du produit." };
  }

  redirect("/admin/produits");
}

export async function deleteProductAction(id: string): Promise<void> {
  await deleteProduct(id);
  redirect("/admin/produits");
}
