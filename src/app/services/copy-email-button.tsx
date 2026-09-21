"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (older browser, no permission) — the
      // address is already shown as plain, selectable text above.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/10"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Adresse copiée
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copier l&rsquo;adresse
        </>
      )}
    </button>
  );
}
