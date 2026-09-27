import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Pencil } from "lucide-react";
import { getAllCategories, getProductCountsByCategory } from "@/lib/categories-db";
import { seedGradient } from "@/lib/photo-palette";
import { CategoryDeleteButton } from "./category-delete-button";

export const metadata: Metadata = {
  title: "Catégories — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [categories, productCounts] = await Promise.all([
    getAllCategories(),
    getProductCountsByCategory(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Catégories ({categories.length})
        </h1>
        <Link
          href="/admin/categories/nouveau"
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          <Plus className="h-4 w-4" /> Nouvelle catégorie
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-xs font-bold uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Produits</th>
              <th className="px-4 py-3">Vedette accueil</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-brand-green/5">
                <td className="px-4 py-3">
                  <span
                    style={{ background: seedGradient(c.photoSeed) }}
                    className="block h-8 w-8 rounded-full"
                  />
                </td>
                <td className="px-4 py-3 font-semibold text-brand-green-dark">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-ink/60">{c.slug}</td>
                <td className="px-4 py-3 text-ink/60">
                  {productCounts[c.id] ?? 0}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {c.featuredHome ? "Oui" : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/categories/${c.id}`}
                      aria-label={`Modifier ${c.name}`}
                      className="rounded-full p-2 text-brand-green hover:bg-ivory"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <CategoryDeleteButton id={c.id} name={c.name} />
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
