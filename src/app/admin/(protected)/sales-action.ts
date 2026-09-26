"use server";

import { getSalesOverTime, type SalesPeriod, type SalesSeries } from "@/lib/orders-db";

export async function getSalesOverTimeAction(period: SalesPeriod): Promise<SalesSeries[]> {
  return getSalesOverTime(period);
}
