"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PRODUCTS } from "@/data/products";
import { useZone } from "./zone-context";
import type { Product } from "@/lib/types";

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartItem extends CartLine {
  product: Product;
  lineTotal: number;
}

interface CartContextValue {
  lines: CartLine[];
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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

  const addItem = useCallback((productId: string, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId
            ? { ...l, quantity: l.quantity + quantity }
            : l
        );
      }
      return [...prev, { productId, quantity }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l
      );
    });
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const items = useMemo<CartItem[]>(() => {
    return lines
      .map((line) => {
        const product = PRODUCTS.find((p) => p.id === line.productId);
        if (!product) return null;
        const unitPrice = priceFor(product);
        return {
          ...line,
          product,
          lineTotal: unitPrice * line.quantity,
        };
      })
      .filter((item): item is CartItem => item !== null);
  }, [lines, priceFor]);

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
