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
import { priceForQuantity } from "@/lib/price-tiers";
import type { PublicProduct, Zone, ZoneId } from "@/lib/types";
import type { ShippingSettings } from "@/lib/shipping-types";

type ZoneWithShipping = Zone & Pick<ShippingSettings, "shippingFee" | "minOrderAmount">;

interface ZoneContextValue {
  zoneId: ZoneId;
  zone: ZoneWithShipping;
  setZoneId: (zoneId: ZoneId) => void;
  /** The applicable unit price for that quantity (tiered pricing) — quantity
   *  defaults to 1, i.e. the base price, for callers that don't care (cards). */
  priceFor: (product: PublicProduct, quantity?: number) => number | null;
  format: (amount: number) => string;
  /** Adopts a shipping rule the server just reported (after the customer
   *  agreed to a price change), instead of waiting for a page reload. */
  applyShippingSettings: (settings: ShippingSettings) => void;
  /** The shipping rules of every zone exactly as Réglages holds them, or null
   *  until they have really been loaded (and whenever they could not be): then
   *  `zone` above only carries the code's built-in fallback values, which
   *  must never be presented to the customer as the shop's real figures. */
  liveShipping: Record<ZoneId, ShippingSettings> | null;
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
  const [shippingLive, setShippingLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/shipping-settings")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: Record<ZoneId, ShippingSettings> | null) => {
          if (data && !cancelled) {
            setShipping(data);
            setShippingLive(true);
          }
        })
        .catch(() => {
          /* keep static fallback thresholds, no shipping fee ever blocks checkout */
        });
    };
    load();
    // A visitor who opened the site without a connection gets the real figures
    // as soon as it comes back.
    window.addEventListener("online", load);
    return () => {
      cancelled = true;
      window.removeEventListener("online", load);
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

  const applyShippingSettings = useCallback((settings: ShippingSettings) => {
    setShipping((prev) => ({ ...prev, [settings.zoneId]: settings }));
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
      priceFor: (product: PublicProduct, quantity = 1) =>
        priceForQuantity(product, zoneId, quantity),
      format: (amount: number) => formatPrice(amount, zoneId),
      applyShippingSettings,
      liveShipping: shippingLive ? shipping : null,
    };
  }, [zoneId, setZoneId, shipping, shippingLive, applyShippingSettings]);

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within a ZoneProvider");
  return ctx;
}
