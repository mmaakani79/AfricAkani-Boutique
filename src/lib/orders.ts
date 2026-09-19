import type { ZoneId } from "./types";

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  createdAt: string;
  zoneId: ZoneId;
  subtotal: number;
  freeShippingReached: boolean;
  items: OrderItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
}

const STORAGE_KEY = "africakani.orders";

export function getOrders(): Order[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order): void {
  try {
    const orders = getOrders();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([order, ...orders])
    );
  } catch {
    /* ignore */
  }
}
