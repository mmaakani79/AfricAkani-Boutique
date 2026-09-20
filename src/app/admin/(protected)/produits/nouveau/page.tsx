import type { Metadata } from "next";
import { ProductForm } from "../product-form";
import { createProductAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Nouveau produit — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Nouveau produit
      </h1>
      <ProductForm action={createProductAction} submitLabel="Créer le produit" />
    </div>
  );
}
