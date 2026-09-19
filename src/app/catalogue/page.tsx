import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogueClient } from "./catalogue-client";

export const metadata: Metadata = {
  title: "Catalogue — AfricAkani",
  description:
    "Le catalogue AfricAkani : produits naturels, halal, et sélection généraliste utile au quotidien.",
};

export default function CataloguePage() {
  return (
    <Suspense fallback={null}>
      <CatalogueClient />
    </Suspense>
  );
}
