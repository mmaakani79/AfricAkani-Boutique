"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-api-auth";
import { changeClientShopStatus, createClientShop, getClientShop } from "@/lib/client-shops-db";
import { getServiceAccountFull } from "@/lib/service-accounts-db";
import { cleanDomain, deriveShopKey, type ShopStatus } from "@/lib/shop-status";

export interface ShopActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function refresh(shopId?: string) {
  revalidatePath("/admin/boutiques");
  if (shopId) revalidatePath(`/admin/boutiques/${shopId}`);
}

function origin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.africakani.com").replace(/\/+$/, "");
}

export async function createShopAction(_previous: ShopActionState, formData: FormData): Promise<ShopActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Indiquez le nom de la boutique cliente." };
  const domain = cleanDomain(String(formData.get("domain") ?? ""));
  if (domain === null) return { error: "Le nom de domaine n'est pas valide (exemple : boutique-djougou.com)." };
  const accountId = String(formData.get("accountId") ?? "").trim();
  if (accountId && !(await getServiceAccountFull(accountId))) return { error: "Ce dossier de paiement est introuvable." };
  const shop = await createClientShop({
    name,
    domain,
    accountId: accountId || null,
    note: String(formData.get("note") ?? "").trim().slice(0, 500),
  });
  refresh(shop.id);
  return { ok: true, message: `Boutique ajoutée : ${shop.id}.` };
}

async function change(shopId: string, to: ShopStatus, reason: string, okMessage: string): Promise<ShopActionState> {
  const result = await changeClientShopStatus(shopId, to, reason);
  refresh(shopId);
  return result.ok ? { ok: true, message: okMessage } : { error: result.error };
}

export async function suspendShopAction(
  shopId: string,
  _previous: ShopActionState,
  formData: FormData
): Promise<ShopActionState> {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Indiquez le motif de la suspension : il est gardé dans le journal." };
  if (formData.get("confirm") !== "yes") return { error: "Cochez la case pour confirmer la suspension." };
  return change(shopId, "suspendu", reason, "Boutique suspendue. Elle affichera la page « temporairement indisponible ».");
}

/** One click: the shop opens again. */
export async function reactivateShopAction(shopId: string): Promise<ShopActionState> {
  await requireAdmin();
  return change(shopId, "actif", "Réactivée à la main.", "Boutique réactivée : elle est de nouveau ouverte.");
}

export async function markShopLateAction(shopId: string, late: boolean): Promise<ShopActionState> {
  await requireAdmin();
  return late
    ? change(shopId, "en_retard", "Marquée en retard (aucun effet pour le public).", "Boutique marquée « en retard » (elle reste ouverte).")
    : change(shopId, "actif", "Retour à « actif ».", "Boutique de nouveau « active ».");
}

export async function markShopDeletedAction(
  shopId: string,
  _previous: ShopActionState,
  formData: FormData
): Promise<ShopActionState> {
  await requireAdmin();
  if (formData.get("confirm") !== "yes") return { error: "Cochez la case pour confirmer : ce choix est définitif." };
  return change(shopId, "supprime", String(formData.get("reason") ?? ""), "Boutique marquée « supprimée ».");
}

export interface ShopKeyState {
  error?: string;
  address?: string;
  key?: string;
}

/** The key the client shop uses to check the answers, shown to the admin on request only (never put in a page by default). */
export async function revealShopKeyAction(shopId: string): Promise<ShopKeyState> {
  await requireAdmin();
  const shop = await getClientShop(shopId);
  if (!shop) return { error: "Boutique introuvable." };
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return { error: "La clé ne peut pas être calculée : ADMIN_SESSION_SECRET n'est pas définie sur ce site." };
  return {
    address: `${origin()}/api/boutiques/${shop.publicKey}/statut`,
    key: deriveShopKey(secret, shop.publicKey),
  };
}
