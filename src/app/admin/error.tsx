"use client";

import { useEffect } from "react";
import { LogIn, RotateCcw } from "lucide-react";

// Shown when an admin action fails to reach the server or is refused — most
// often the 12 h session expired (the proxy answers the form post with a
// redirect to the login page) or the connection dropped.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        L&rsquo;action n&rsquo;a pas abouti
      </h1>
      <p className="text-sm text-ink/60">
        Votre session a peut-être expiré, ou la connexion internet est coupée.
        La dernière modification n&rsquo;a peut-être pas été enregistrée :
        vérifiez avant de la refaire.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <a
          href="/admin/login"
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          <LogIn className="h-4 w-4" /> Se reconnecter
        </a>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-6 py-3 text-sm font-bold text-brand-green hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" /> Réessayer
        </button>
      </div>
      {error.digest && (
        <p className="text-xs text-ink/30">Référence : {error.digest}</p>
      )}
    </div>
  );
}
