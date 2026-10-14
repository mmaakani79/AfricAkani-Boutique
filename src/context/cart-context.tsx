"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useZone } from "./zone-context";
import { ZONES } from "@/data/zones";
import { splitCartByZone, isSoldInZone } from "@/lib/zone-visibility";
import type { PublicProduct, PublicProductVariant } from "@/lib/types";

export interface CartLine {
  product: PublicProduct;
  quantity: number;
  /** The variant chosen on the product page, when the product has variants. */
  variant?: PublicProductVariant;
}

export interface CartItem extends CartLine {
  lineTotal: number;
}

/** Lines are keyed by product id + variant id so the same product with two
 *  different variants (e.g. Taille M vs Taille L) stays on separate lines. */
function lineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

/** Products taken out of the cart because they are not sold in the zone the
 *  customer is now in — shown until the customer dismisses it. */
export interface RemovedFromCartNotice {
  names: string[];
  zoneLabel: string;
}

interface CartContextValue {
  lines: CartLine[];
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: PublicProduct, quantity?: number, variant?: PublicProductVariant) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  /** Replaces the product data kept in the cart (prices, tiers, variants,
   *  stock) with fresh data from the server — only after the customer agreed. */
  refreshProducts: (products: PublicProduct[]) => void;
  removedNotice: RemovedFromCartNotice | null;
  dismissRemovedNotice: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "africakani.cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { priceFor, zoneId, zoneHydrated } = useZone();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [removedNotice, setRemovedNotice] = useState<RemovedFromCartNotice | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // One-time hydration from localStorage on mount; SSR has no access to it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setLines(JSON.parse(stored));
    } catch {
      /* ignore malformed/unavailable storage */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, hydrated]);

  // The cart never keeps a product that is not sold in the zone the customer
  // chose: when the zone changes (or the saved cart is loaded into another
  // zone), those products are removed and the customer is told. Nothing is
  // decided before BOTH the cart and the remembered zone have been read, or a
  // saved Canada cart would be emptied by the default zone for one render.
  useEffect(() => {
    if (!hydrated || !zoneHydrated) return;
    const { removed } = splitCartByZone(lines, zoneId);
    if (removed.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines((prev) => splitCartByZone(prev, zoneId).kept);
    setRemovedNotice({
      names: [...new Set(removed.map((l) => l.product.name))],
      zoneLabel: ZONES[zoneId].label,
    });
  }, [lines, zoneId, hydrated, zoneHydrated]);

  const dismissRemovedNotice = useCallback(() => setRemovedNotice(null), []);

  const addItem = useCallback(
    (product: PublicProduct, quantity = 1, variant?: PublicProductVariant) => {
      // Nothing that is not sold in this zone can enter the cart.
      if (!isSoldInZone(product, zoneId)) return;
      setLines((prev) => {
        const key = lineKey(product.id, variant?.id);
        const existing = prev.find(
          (l) => lineKey(l.product.id, l.variant?.id) === key
        );
        if (existing) {
          return prev.map((l) =>
            lineKey(l.product.id, l.variant?.id) === key
              ? { ...l, quantity: l.quantity + quantity }
              : l
          );
        }
        return [...prev, { product, quantity, variant }];
      });
    },
    [zoneId]
  );

  const removeItem = useCallback((productId: string, variantId?: string) => {
    const key = lineKey(productId, variantId);
    setLines((prev) =>
      prev.filter((l) => lineKey(l.product.id, l.variant?.id) !== key)
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number, variantId?: string) => {
      const key = lineKey(productId, variantId);
      setLines((prev) => {
        if (quantity <= 0) {
          return prev.filter((l) => lineKey(l.product.id, l.variant?.id) !== key);
        }
        return prev.map((l) =>
          lineKey(l.product.id, l.variant?.id) === key ? { ...l, quantity } : l
        );
      });
    },
    []
  );

  const clearCart = useCallback(() => setLines([]), []);

  const refreshProducts = useCallback((fresh: PublicProduct[]) => {
    setLines((prev) =>
      prev.map((line) => {
        const product = fresh.find((p) => p.id === line.product.id);
        if (!product) return line;
        const variant = line.variant
          ? (product.variants?.find((v) => v.id === line.variant!.id) ?? line.variant)
          : undefined;
        // The price check doesn't join reviews/sales: keep what the cart had.
        return {
          ...line,
          product: { ...product, rating: line.product.rating, soldCount: line.product.soldCount },
          variant,
        };
      })
    );
  }, []);

  // Only products sold in the current zone count (an unsold line that has not
  // been cleaned up yet must never be priced at 0 and slip into a total).
  const items = useMemo<CartItem[]>(
    () =>
      splitCartByZone(lines, zoneId).kept.map((line) => ({
        ...line,
        lineTotal: (priceFor(line.product, line.quantity) ?? 0) * line.quantity,
      })),
    [lines, priceFor, zoneId]
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const value: CartContextValue = {
    lines,
    items,
    itemCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    refreshProducts,
    removedNotice,
    dismissRemovedNotice,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
