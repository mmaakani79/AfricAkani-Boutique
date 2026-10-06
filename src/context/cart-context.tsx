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

interface CartContextValue {
  lines: CartLine[];
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: PublicProduct, quantity?: number, variant?: PublicProductVariant) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "africakani.cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { priceFor } = useZone();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  const addItem = useCallback(
    (product: PublicProduct, quantity = 1, variant?: PublicProductVariant) => {
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
    []
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

  const items = useMemo<CartItem[]>(
    () =>
      lines.map((line) => ({
        ...line,
        lineTotal: (priceFor(line.product, line.quantity) ?? 0) * line.quantity,
      })),
    [lines, priceFor]
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
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
