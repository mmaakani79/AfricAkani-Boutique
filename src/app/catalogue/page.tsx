import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products-db";
import { getAllCategories } from "@/lib/categories-db";
import { CatalogueClient } from "./catalogue-client";

export const metadata: Metadata = {
  title: "Catalogue — AfricAkani",
  description:
    "Le catalogue AfricAkani : produits naturels, halal, et sélection généraliste utile au quotidien.",
  alternates: { canonical: "/catalogue" },
};

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);

  return (
    <Suspense fallback={null}>
      <CatalogueClient products={products} categories={categories} />
    </Suspense>
  );
}
