"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/admin/password-field";
import { loginAction, type ActionState } from "../actions";

const initialState: ActionState = {};

// Without a connection the submission itself fails: show a message instead of an error page.
async function loginOrExplain(previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    return await loginAction(previous, formData);
  } catch {
    return { error: "Connexion impossible : vérifiez votre réseau puis réessayez." };
  }
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginOrExplain,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <PasswordField
        label="Mot de passe"
        name="password"
        required
        autoFocus
        autoComplete="current-password"
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand-green py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
