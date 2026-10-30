/**
 * Runs a server action from a button and never lets a network failure break the page: with no
 * connection (or a server that cannot answer) the person sees a plain message and keeps what they
 * were doing. Nothing is assumed done: the message says to check before trying again.
 */
export const ACTION_FAILED_MESSAGE =
  "L'action n'a pas abouti (connexion ou serveur). Vérifiez votre connexion, actualisez la page pour voir l'état réel, puis réessayez.";

export async function safely<T extends { error?: string }>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    return { error: ACTION_FAILED_MESSAGE } as T;
  }
}
