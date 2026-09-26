import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";

// Public and read-only: the checkout page needs to know whether it can
// offer "Payer par carte" — nothing sensitive in a boolean flag.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: isStripeConfigured() });
}
