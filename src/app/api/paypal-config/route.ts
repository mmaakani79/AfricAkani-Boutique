import { NextResponse } from "next/server";
import { isPaypalConfigured } from "@/lib/paypal";

// Public and read-only: the checkout page needs to know whether it can
// offer "Payer avec PayPal" — nothing sensitive in a boolean flag.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: isPaypalConfigured() });
}
