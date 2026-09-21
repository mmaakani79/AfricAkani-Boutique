"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteOrder,
  getOrderById,
  recordReminder,
  setOrderEmailError,
  setOrderTest,
  updateOrderPaymentStatus,
  updateOrderStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders-db";
import { formatEmailError, sendCustomerOrderShipped } from "@/lib/email";

export interface OrderActionState {
  error?: string;
}

export async function updateOrderStatusAction(
  id: string,
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const status = String(formData.get("status") ?? "") as OrderStatus;

  const ok = await updateOrderStatus(id, status);
  if (!ok) return { error: "Commande introuvable." };

  if (status === "expediee") {
    try {
      const order = await getOrderById(id);
      if (order) {
        await sendCustomerOrderShipped(order);
        await setOrderEmailError(id, null);
      }
    } catch (err) {
      // Status change already saved; email failure shouldn't block the admin,
      // but it must not be hidden either.
      const message = `e-mail « expédiée » : ${formatEmailError(err)}`;
      console.error(`[email] Commande ${id} : ${message}`);
      await setOrderEmailError(id, message);
    }
  }

  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/commandes");
  return {};
}

export async function updateOrderPaymentAction(
  id: string,
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const paymentStatus = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim() || null;
  const confirmed = formData.get("confirm") === "on";

  if (paymentStatus === "paye" && !confirmed) {
    return {
      error:
        "Merci de cocher la confirmation avant de marquer cette commande comme payée.",
    };
  }

  const ok = await updateOrderPaymentStatus(id, paymentStatus, paymentMethod);
  if (!ok) return { error: "Commande introuvable." };

  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  return {};
}

export async function deleteOrderAction(id: string): Promise<void> {
  await deleteOrder(id);
  redirect("/admin/commandes");
}

export async function setOrderTestAction(
  id: string,
  isTest: boolean
): Promise<void> {
  await setOrderTest(id, isTest);
  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
}

export async function logWhatsappReminderAction(id: string): Promise<void> {
  await recordReminder(id, "whatsapp", "whatsapp_manual", "Relance manuelle depuis l'admin");
  revalidatePath(`/admin/commandes/${id}`);
}
