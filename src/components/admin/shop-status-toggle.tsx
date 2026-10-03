"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store, Lock } from "lucide-react";
import { setShopClosedAction } from "@/app/admin/actions";

export function ShopStatusToggle({
  initialClosed,
  envClosed,
  overridden,
}: {
  initialClosed: boolean;
  envClosed: boolean;
  overridden: boolean;
}) {
  const router = useRouter();
  const [closed, setClosed] = useState(initialClosed);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<boolean>(false);

  function change(nextClosed: boolean) {
    setError(null);
    setSavedAt(false);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("Vous êtes hors ligne — le réglage n'a pas été modifié. Reconnectez-vous puis réessayez.");
      return;
    }
    if (
      nextClosed &&
      !window.confirm(
        "Fermer la boutique ? Tous les visiteurs verront la page « ouvre très bientôt » (l'admin reste accessible)."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await setShopClosedAction(nextClosed);
        if (!result.ok) {
          setError(result.error ?? "Le réglage n'a pas pu être enregistré.");
          return;
        }
        // Only reflect the new state once the server has confirmed it.
        setClosed(nextClosed);
        setSavedAt(true);
        router.refresh();
      } catch {
        setError(
          "Impossible de joindre le serveur — le réglage n'a pas été modifié. Vérifiez votre connexion puis réessayez."
        );
      }
    });
  }

  return (
    <section
      aria-label="Statut de la boutique"
      className={`rounded-2xl border p-4 ${
        closed ? "border-red-200 bg-red-50" : "border-brand-green/20 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              closed ? "bg-red-600 text-white" : "bg-brand-green text-white"
            }`}
          >
            {closed ? <Lock className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink/50">
              Boutique en ligne
            </p>
            <p
              data-testid="shop-status-label"
              className={`font-brand text-lg font-bold ${
                closed ? "text-red-700" : "text-brand-green-dark"
              }`}
            >
              {closed ? "Fermée au public" : "Ouverte au public"}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={!closed}
          aria-label="Boutique ouverte"
          disabled={pending}
          onClick={() => change(!closed)}
          className="flex items-center gap-3 rounded-full border border-brand-green/20 bg-white px-4 py-2 text-sm font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
        >
          <span
            className={`relative inline-block h-6 w-11 rounded-full transition-colors ${
              closed ? "bg-ink/25" : "bg-brand-green"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                closed ? "left-0.5" : "left-[22px]"
              }`}
            />
          </span>
          {pending ? "Enregistrement…" : closed ? "Rouvrir la boutique" : "Fermer la boutique"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      {!error && savedAt && (
        <p role="status" className="mt-3 text-xs font-semibold text-brand-green-dark">
          ✓ Enregistré — effectif en quelques secondes sur africakani.com.
        </p>
      )}
      <p className="mt-3 text-[11px] text-ink/50">
        Ce réglage est prioritaire sur la variable Vercel MAINTENANCE_MODE
        {!overridden && envClosed && !savedAt
          ? " (actuellement à « true » sur Vercel : la boutique est fermée tant que vous n'utilisez pas cet interrupteur)"
          : ""}
        . L&rsquo;admin et les paiements (webhooks) restent toujours accessibles.
      </p>
    </section>
  );
}
