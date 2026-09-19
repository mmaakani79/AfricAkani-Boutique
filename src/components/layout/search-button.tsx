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
      className="flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-white px-3 py-2 text-sm font-medium text-brand-green hover:border-brand-green/40"
    >
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Recherche</span>
    </button>
  );
}
