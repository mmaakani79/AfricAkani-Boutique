"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function GlobalError({
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-ivory px-4 py-24 text-center">
      <Image
        src="/logo/medallion.png"
        alt="AfricAkani"
        width={56}
        height={56}
        className="h-14 w-14 rounded-full"
      />
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Le site rencontre un problème technique
      </h1>
      <p className="max-w-md text-sm text-ink/60">
        Merci de réessayer dans quelques instants. Si le problème persiste,
        contactez-nous sur WhatsApp.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          Réessayer
        </button>
        <a
          href="https://wa.me/15148673738"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-brand-green px-6 py-3 text-sm font-bold text-brand-green hover:bg-white"
        >
          Nous contacter
        </a>
      </div>
      {error.digest && (
        <p className="mt-2 text-xs text-ink/30">Référence : {error.digest}</p>
      )}
    </div>
  );
}
