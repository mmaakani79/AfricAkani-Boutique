"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PackagingTypeRecord } from "@/lib/types";

interface PackagingContextValue {
  packagingTypes: PackagingTypeRecord[];
  getPackagingTypeById: (id: string) => PackagingTypeRecord | undefined;
}

const PackagingContext = createContext<PackagingContextValue | null>(null);

export function PackagingProvider({ children }: { children: React.ReactNode }) {
  const [packagingTypes, setPackagingTypes] = useState<PackagingTypeRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/packaging-types")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PackagingTypeRecord[]) => {
        if (!cancelled) setPackagingTypes(data);
      })
      .catch(() => {
        /* keep the empty list — callers fall back to showing nothing/an icon only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PackagingContextValue>(() => {
    const byId = new Map(packagingTypes.map((p) => [p.id, p]));
    return {
      packagingTypes,
      getPackagingTypeById: (id: string) => byId.get(id),
    };
  }, [packagingTypes]);

  return (
    <PackagingContext.Provider value={value}>{children}</PackagingContext.Provider>
  );
}

export function usePackagingTypes() {
  const ctx = useContext(PackagingContext);
  if (!ctx) throw new Error("usePackagingTypes must be used within a PackagingProvider");
  return ctx;
}
