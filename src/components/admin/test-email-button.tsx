"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { sendTestEmailAction } from "@/app/admin/actions";

export function TestEmailButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(
    null
  );

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await sendTestEmailAction());
          });
        }}
        className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60"
      >
        <Mail className="h-3.5 w-3.5" />{" "}
        {pending ? "Envoi…" : "Envoyer un e-mail de test"}
      </button>
      {result && (
        <p
          className={`mt-2 text-xs font-semibold ${
            result.ok ? "text-brand-green-dark" : "text-red-600"
          }`}
        >
          {result.ok ? "✓ " : "✗ "}
          {result.detail}
        </p>
      )}
    </div>
  );
}
