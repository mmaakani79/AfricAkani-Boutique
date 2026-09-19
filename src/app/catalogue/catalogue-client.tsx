"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { CATEGORIES } from "@/data/categories";
import { ProductCard } from "@/components/shop/product-card";
import type { HalalStatus } from "@/lib/types";

const HALAL_FILTERS: { value: HalalStatus | "tous"; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "oui", label: "Halal vérifié" },
  { value: "a_verifier", label: "À vérifier" },
];

export function CatalogueClient() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categorie") ?? "toutes"
  );
  const [halal, setHalal] = useState<HalalStatus | "tous">(
    (searchParams.get("halal") as HalalStatus | null) ?? "tous"
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (categoryId !== "toutes" && p.categoryId !== categoryId) return false;
      if (halal !== "tous" && p.halal !== halal) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, categoryId, halal]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-brand text-3xl font-bold text-brand-green-dark">
        Catalogue
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        {filtered.length} produit{filtered.length > 1 ? "s" : ""} disponible
        {filtered.length > 1 ? "s" : ""}
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-brand-green/20 bg-white px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-brand-green/60" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {HALAL_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setHalal(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
              halal === f.value
                ? "border-brand-green bg-brand-green text-ivory"
                : "border-brand-green/20 bg-white text-brand-green-dark hover:border-brand-green/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setCategoryId("toutes")}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
            categoryId === "toutes"
              ? "border-brand-gold bg-brand-gold text-brand-green-dark"
              : "border-brand-green/20 bg-white text-brand-green-dark hover:border-brand-green/40"
          }`}
        >
          Toutes les catégories
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
              categoryId === c.id
                ? "border-brand-gold bg-brand-gold text-brand-green-dark"
                : "border-brand-green/20 bg-white text-brand-green-dark hover:border-brand-green/40"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink/50">
          Aucun produit ne correspond à votre recherche.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
