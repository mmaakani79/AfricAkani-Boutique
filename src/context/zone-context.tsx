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
import type { Product, Zone, ZoneId } from "@/lib/types";
import type { ShippingSettings } from "@/lib/shipping-types";

type ZoneWithShipping = Zone & Pick<ShippingSettings, "shippingFee" | "minOrderAmount">;

interface ZoneContextValue {
  zoneId: ZoneId;
  zone: ZoneWithShipping;
  setZoneId: (zoneId: ZoneId) => void;
  priceFor: (product: Product) => number | null;
  format: (amount: number) => string;
}

const ZoneContext = createContext<ZoneContextValue | null>(null);

const STORAGE_KEY = "africakani.zone";

// Fallback while /api/shipping-settings loads (and if it ever fails): the
// static thresholds from zones.ts, no fee, no minimum — never blocks checkout.
const DEFAULT_SHIPPING: Record<ZoneId, ShippingSettings> = (
  Object.keys(ZONES) as ZoneId[]
).reduce(
  (acc, zoneId) => {
    acc[zoneId] = {
      zoneId,
      freeShippingThreshold: ZONES[zoneId].freeShippingThreshold,
      shippingFee: 0,
      minOrderAmount: null,
    };
    return acc;
  },
  {} as Record<ZoneId, ShippingSettings>
);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const [zoneId, setZoneIdState] = useState<ZoneId>(DEFAULT_ZONE);
  const [shipping, setShipping] = useState<Record<ZoneId, ShippingSettings>>(
    DEFAULT_SHIPPING
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<ZoneId, ShippingSettings> | null) => {
        if (data && !cancelled) setShipping(data);
      })
      .catch(() => {
        /* keep static fallback thresholds, no shipping fee ever blocks checkout */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const zoneSettings = shipping[zoneId];
    const zone: ZoneWithShipping = {
      ...ZONES[zoneId],
      freeShippingThreshold: zoneSettings.freeShippingThreshold,
      shippingFee: zoneSettings.shippingFee,
      minOrderAmount: zoneSettings.minOrderAmount,
    };
    return {
      zoneId,
      zone,
      setZoneId,
      priceFor: (product: Product) => product.prices[zoneId],
      format: (amount: number) => formatPrice(amount, zoneId),
    };
  }, [zoneId, setZoneId, shipping]);

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within a ZoneProvider");
  return ctx;
}
