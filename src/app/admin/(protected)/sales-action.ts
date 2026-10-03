"use server";

import { requireAdmin } from "@/lib/admin-api-auth";

import { getSalesOverTime, type SalesPeriod, type SalesSeries } from "@/lib/orders-db";

export async function getSalesOverTimeAction(period: SalesPeriod): Promise<SalesSeries[]> {
  await requireAdmin();
  return getSalesOverTime(period);
}
