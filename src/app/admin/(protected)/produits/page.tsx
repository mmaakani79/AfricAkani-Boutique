import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getAllProducts } from "@/lib/products-db";
import { getCategoryById } from "@/data/categories";
import { formatPrice } from "@/data/zones";
import { deleteProductAction } from "../../actions";

export const metadata: Metadata = {
  title: "Produits — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Produits ({products.length})
        </h1>
        <Link
          href="/admin/produits/nouveau"
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          <Plus className="h-4 w-4" /> Ajouter un produit
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-xs font-bold uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix (Bénin)</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Vedette</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-brand-green/5">
                <td className="px-4 py-3 font-semibold text-brand-green-dark">
                  {p.name}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {getCategoryById(p.categoryId)?.name ?? p.categoryId}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {formatPrice(p.prices.bj, "bj")}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {p.stock === "en_stock" && "En stock"}
                  {p.stock === "stock_limite" && "Stock limité"}
                  {p.stock === "rupture" && "Rupture"}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {p.featured ? "Oui" : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/produits/${p.id}`}
                      aria-label={`Modifier ${p.name}`}
                      className="rounded-full p-2 text-brand-green hover:bg-ivory"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form
                      action={deleteProductAction.bind(null, p.id)}
                    >
                      <button
                        type="submit"
                        aria-label={`Supprimer ${p.name}`}
                        className="rounded-full p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
