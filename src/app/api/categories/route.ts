import { NextResponse } from "next/server";
import { getAllCategories } from "@/lib/categories-db";

// Public and read-only: client components (product cards, cart, catalogue
// filters) need the category list to resolve names/icons — nothing sensitive.
export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await getAllCategories();
  return NextResponse.json(categories);
}
