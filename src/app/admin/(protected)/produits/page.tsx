import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Upload, FileDown } from "lucide-react";
import { getAllProducts } from "@/lib/products-db";
import { getAllCategories } from "@/lib/categories-db";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = {
  title: "Produits — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Produits ({products.length})
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/products/template"
            className="flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-white px-4 py-2 text-sm font-bold text-brand-green-dark hover:bg-ivory"
          >
            <FileDown className="h-4 w-4" /> Télécharger le modèle
          </a>
          <Link
            href="/admin/produits/importer"
            className="flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-white px-4 py-2 text-sm font-bold text-brand-green-dark hover:bg-ivory"
          >
            <Upload className="h-4 w-4" /> Importer un fichier Excel
          </Link>
          <Link
            href="/admin/produits/nouveau"
            className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-ivory hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" /> Ajouter un produit
          </Link>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink/50">
        Glissez la poignée <span className="font-semibold">⠿</span> à gauche de chaque
        ligne pour réorganiser les produits — cet ordre est celui utilisé sur la
        boutique.
      </p>

      <div className="mt-4">
        <ProductsTable products={products} categories={categories} />
      </div>
    </div>
  );
}
