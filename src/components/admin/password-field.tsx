"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  name,
  required,
  autoFocus,
  autoComplete,
}: {
  label: string;
  name: string;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-xs font-semibold text-ink/60">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-brand-green/20 bg-ivory px-3.5 py-2.5 pr-11 text-sm outline-none focus:border-brand-green"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink/40 hover:text-brand-green-dark"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
