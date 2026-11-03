"use client";

import { useActionState, useCallback, useRef, type FormEvent } from "react";

/**
 * `useActionState` for a form whose typed values must survive a refused submission.
 * React resets a form after its action finishes, even when the action answered with an
 * error: the person would have to type everything again (a phone number and a transaction
 * code on a phone, or three tranches with their dates). Here the reset is cancelled when the
 * action returned an `error`; after a success the form is reset as usual.
 */
export function useKeptFormAction<S extends { error?: string }>(
  action: (previous: S, formData: FormData) => Promise<S>,
  initial: S
) {
  const keep = useRef(false);
  const wrapped = useCallback(
    async (previous: S, formData: FormData) => {
      let next: S;
      try {
        next = await action(previous, formData);
      } catch {
        // No connection, or the server could not answer: keep the page and what was typed.
        next = {
          ...previous,
          error:
            "L'envoi n'a pas abouti. Vérifiez votre connexion puis réessayez. Si vous aviez déjà envoyé, ne le renvoyez pas : actualisez la page pour voir ce qui est enregistré.",
        };
      }
      keep.current = Boolean(next.error);
      return next;
    },
    [action]
  );
  // The generic S is a plain state object; React's own typing (Awaited<S>) cannot see that.
  const [state, formAction, pending] = useActionState(
    wrapped as unknown as (previous: unknown, formData: FormData) => Promise<unknown>,
    initial as unknown
  ) as unknown as [S, (formData: FormData) => void, boolean];
  const onReset = useCallback((event: FormEvent<HTMLFormElement>) => {
    if (keep.current) event.preventDefault();
  }, []);
  return { state, formAction, pending, onReset };
}
