"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/catalogue?q=${encodeURIComponent(q)}` : "/catalogue");
    setOpen(false);
    setQuery("");
  }

  if (open) {
    return (
      <form
        onSubmit={submit}
        className="flex items-center gap-1 rounded-full border border-brand-green/30 bg-white pl-3 pr-1 py-1"
      >
        <Search className="h-4 w-4 text-brand-green/60" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-32 sm:w-48 bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer la recherche"
          className="rounded-full p-1 text-ink/50 hover:bg-ivory hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Rechercher un produit"
      className="flex items-center gap-2 rounded-full border border-brand-green/15 bg-white px-2.5 py-2 text-sm text-ink/40 hover:border-brand-green/30 hover:text-ink/60 sm:px-3.5"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Rechercher un produit…</span>
    </button>
  );
}
