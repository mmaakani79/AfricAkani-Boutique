"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Category } from "@/lib/types";

interface CategoryContextValue {
  categories: Category[];
  getCategoryById: (id: string) => Category | undefined;
  getCategoryBySlug: (slug: string) => Category | undefined;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Category[]) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        /* keep the empty list — PhotoPlaceholder/icons fall back gracefully */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CategoryContextValue>(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const bySlug = new Map(categories.map((c) => [c.slug, c]));
    return {
      categories,
      getCategoryById: (id: string) => byId.get(id),
      getCategoryBySlug: (slug: string) => bySlug.get(slug),
    };
  }, [categories]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error("useCategories must be used within a CategoryProvider");
  return ctx;
}
