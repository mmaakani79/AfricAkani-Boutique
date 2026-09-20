"use server";

import { createOrder, type OrderInput } from "@/lib/orders-db";

export async function submitOrderAction(input: OrderInput): Promise<void> {
  await createOrder(input);
}
