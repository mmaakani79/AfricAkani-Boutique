"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePackagingTypeAction } from "./actions";

export function PackagingTypeDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Supprimer ${name}`}
        onClick={() => {
          if (!window.confirm(`Supprimer le type d'emballage « ${name} » ?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deletePackagingTypeAction(id);
            if (result?.error) setError(result.error);
          });
        }}
        className="rounded-full p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
