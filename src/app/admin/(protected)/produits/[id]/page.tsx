import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products-db";
import { ProductForm } from "../product-form";
import { updateProductAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Modifier le produit — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Modifier « {product.name} »
      </h1>
      <ProductForm
        product={product}
        action={updateProductAction.bind(null, id)}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
