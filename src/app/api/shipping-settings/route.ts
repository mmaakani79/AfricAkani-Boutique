import { NextResponse } from "next/server";
import { getAllShippingSettings } from "@/lib/shipping-settings-db";

// Public and read-only: the storefront (cart, checkout, banners) needs the
// live per-zone shipping thresholds/fees on every page load, including
// statically-generated ones, so it's fetched client-side rather than baked
// in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAllShippingSettings();
  return NextResponse.json(settings);
}
