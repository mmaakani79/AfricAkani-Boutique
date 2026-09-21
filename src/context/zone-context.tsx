"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_ZONE, ZONES, formatPrice } from "@/data/zones";
import type { Product, ZoneId } from "@/lib/types";

interface ZoneContextValue {
  zoneId: ZoneId;
  zone: (typeof ZONES)[ZoneId];
  setZoneId: (zoneId: ZoneId) => void;
  priceFor: (product: Product) => number | null;
  format: (amount: number) => string;
}

const ZoneContext = createContext<ZoneContextValue | null>(null);

const STORAGE_KEY = "africakani.zone";

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const [zoneId, setZoneIdState] = useState<ZoneId>(DEFAULT_ZONE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ZoneId | null;
      if (stored && stored in ZONES) {
        // One-time hydration from localStorage on mount; SSR has no access to it.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setZoneIdState(stored);
      }
    } catch {
      /* localStorage unavailable, keep default zone */
    }
  }, []);

  const setZoneId = useCallback((next: ZoneId) => {
    setZoneIdState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ZoneContextValue>(() => {
    const zone = ZONES[zoneId];
    return {
      zoneId,
      zone,
      setZoneId,
      priceFor: (product: Product) => product.prices[zoneId],
      format: (amount: number) => formatPrice(amount, zoneId),
    };
  }, [zoneId, setZoneId]);

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within a ZoneProvider");
  return ctx;
}
