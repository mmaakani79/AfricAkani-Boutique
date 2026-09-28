"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/admin-auth";
import { verifyAdminPassword } from "@/lib/admin-password-db";
import {
  createProduct,
  deleteProduct,
  slugify,
  updateProduct,
  type ProductInput,
} from "@/lib/products-db";
import type {
  HalalStatus,
  PackagingType,
  PriceTier,
  ProductVariant,
  StockStatus,
  VariantOption,
  ZoneId,
} from "@/lib/types";
import { sendTestEmail, type TestEmailResult } from "@/lib/email";

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
    ok = await verifyAdminPassword(password);
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
  const imageRaw = String(formData.get("image") ?? "").trim();
  const galleryImages = formData
    .getAll("galleryImages")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const videoUrlRaw = String(formData.get("videoUrl") ?? "").trim();

  // Three parallel arrays (one entry per tier, in DOM order) rather than a
  // single JSON field — PriceTiersField renders each tier as plain hidden
  // inputs, so this reads back the same way FormData naturally groups them.
  const tierZones = formData.getAll("tierZone").map(String);
  const tierMinQtys = formData.getAll("tierMinQty").map(String);
  const tierPrices = formData.getAll("tierPrice").map(String);
  const priceTiers: Partial<Record<ZoneId, PriceTier[]>> = { bj: [], ca: [], us: [] };
  tierZones.forEach((zoneId, i) => {
    const minQty = Number(tierMinQtys[i]);
    const price = Number(tierPrices[i]);
    if (
      (zoneId === "bj" || zoneId === "ca" || zoneId === "us") &&
      Number.isFinite(minQty) &&
      minQty > 1 &&
      Number.isFinite(price) &&
      price >= 0
    ) {
      priceTiers[zoneId]!.push({ minQty, price });
    }
  });

  // Same parallel-arrays convention as the price tiers above — one entry per
  // option/variant row, in DOM order (see VariantsField).
  const variantOptionNames = formData.getAll("variantOptionName").map(String);
  const variantOptionValues = formData.getAll("variantOptionValues").map(String);
  const variantOptions: VariantOption[] = variantOptionNames
    .map((name, i) => ({
      name: name.trim(),
      values: (variantOptionValues[i] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }))
    .filter((o) => o.name && o.values.length > 0);

  const variantIds = formData.getAll("variantId").map(String);
  const variantAttributesRaw = formData.getAll("variantAttributes").map(String);
  const variantSkus = formData.getAll("variantSku").map(String);
  const variantStocks = formData.getAll("variantStock").map(String);
  const variants: ProductVariant[] = variantIds
    .map((id, i) => {
      let attributes: Record<string, string> = {};
      try {
        attributes = JSON.parse(variantAttributesRaw[i] ?? "{}");
      } catch {
        attributes = {};
      }
      return {
        id,
        attributes,
        sku: (variantSkus[i] ?? "").trim(),
        stock: (variantStocks[i] || "en_stock") as StockStatus,
      };
    })
    .filter((v) => v.sku && Object.keys(v.attributes).length > 0);

  return {
    name,
    slug: slugRaw ? slugify(slugRaw) : slugify(name),
    sku: skuRaw || undefined,
    categoryId: String(formData.get("categoryId") ?? ""),
    halal: String(formData.get("halal") ?? "n/a") as HalalStatus,
    unit: String(formData.get("unit") ?? "").trim(),
    packaging: String(formData.get("packaging") ?? "carton_boite") as PackagingType,
    description: String(formData.get("description") ?? "").trim(),
    longDescription: String(formData.get("longDescription") ?? "").trim(),
    prices: {
      bj: readPrice(formData, "priceBj"),
      ca: readPrice(formData, "priceCa"),
      us: readPrice(formData, "priceUs"),
    },
    stock: String(formData.get("stock") ?? "en_stock") as StockStatus,
    featured: formData.get("featured") === "on",
    // The form's hidden field is always present — "" means the admin
    // explicitly removed the image, a URL means they set/kept one. Never
    // undefined here, so this always overwrites (see ProductInput.image).
    image: imageRaw,
    // Always the full current list — GalleryUploadField re-sends every URL
    // it wants kept, so an empty array here means "clear the gallery", not
    // "leave it untouched" (see ProductInput.galleryImages).
    galleryImages,
    videoUrl: videoUrlRaw,
    priceTiers,
    variantOptions,
    variants,
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

export async function sendTestEmailAction(): Promise<TestEmailResult> {
  return sendTestEmail();
}
