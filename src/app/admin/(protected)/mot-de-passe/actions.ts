"use server";

import {
  hashPassword,
  setStoredPasswordHash,
  verifyAdminPassword,
} from "@/lib/admin-password-db";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

const MIN_LENGTH = 8;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  let currentOk: boolean;
  try {
    currentOk = await verifyAdminPassword(currentPassword);
  } catch {
    return {
      error:
        "ADMIN_PASSWORD n'est pas configuré côté serveur. Ajoutez cette variable d'environnement avant de changer le mot de passe.",
    };
  }
  if (!currentOk) {
    return { error: "Mot de passe actuel incorrect." };
  }

  if (newPassword.length < MIN_LENGTH) {
    return {
      error: `Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  if (newPassword === currentPassword) {
    return { error: "Le nouveau mot de passe doit être différent de l'actuel." };
  }

  const hash = await hashPassword(newPassword);
  await setStoredPasswordHash(hash);

  return { success: true };
}
