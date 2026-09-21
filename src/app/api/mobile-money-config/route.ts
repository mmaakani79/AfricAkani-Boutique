import { NextResponse } from "next/server";
import { getMobileMoneyConfig } from "@/lib/mobile-money-db";

// Public and read-only: the checkout page needs the live merchant numbers
// and beneficiary name — that's the whole point of displaying them to the
// customer, so nothing here is sensitive.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getMobileMoneyConfig();
  return NextResponse.json(config);
}
