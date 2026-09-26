"use client";

import { useActionState, useRef, useEffect } from "react";
import { PasswordField } from "@/components/admin/password-field";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 grid max-w-md gap-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      <PasswordField
        label="Mot de passe actuel"
        name="currentPassword"
        required
        autoComplete="current-password"
      />
      <PasswordField
        label="Nouveau mot de passe (8 caractères minimum)"
        name="newPassword"
        required
        autoComplete="new-password"
      />
      <PasswordField
        label="Confirmer le nouveau mot de passe"
        name="confirmPassword"
        required
        autoComplete="new-password"
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green-dark">
          Mot de passe mis à jour. Il sera nécessaire à la prochaine connexion.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
