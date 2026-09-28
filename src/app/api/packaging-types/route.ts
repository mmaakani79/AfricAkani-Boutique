import { NextResponse } from "next/server";
import { getAllPackagingTypes } from "@/lib/packaging-types-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAllPackagingTypes());
}
