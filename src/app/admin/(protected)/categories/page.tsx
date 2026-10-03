import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getAllCategories, getProductCountsByCategory } from "@/lib/categories-db";
import { CategoriesTable } from "./categories-table";

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

      <p className="mt-3 text-xs text-ink/50">
        Maintenez la poignée <span className="font-semibold">⠿</span> à gauche d&rsquo;une
        catégorie (souris ou doigt) et glissez-la pour la déplacer — cet ordre est celui
        de la boutique (accueil et filtres du catalogue).
      </p>

      <div className="mt-4">
        <CategoriesTable categories={categories} productCounts={productCounts} />
      </div>
    </div>
  );
}
