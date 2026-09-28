import type { Metadata } from "next";
import { getAllCategories } from "@/lib/categories-db";
import { getAllPackagingTypes } from "@/lib/packaging-types-db";
import { ProductForm } from "../product-form";
import { createProductAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Nouveau produit — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categories, packagingTypes] = await Promise.all([
    getAllCategories(),
    getAllPackagingTypes(),
  ]);

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Nouveau produit
      </h1>
      <ProductForm
        categories={categories}
        packagingTypes={packagingTypes}
        action={createProductAction}
        submitLabel="Créer le produit"
      />
    </div>
  );
}
