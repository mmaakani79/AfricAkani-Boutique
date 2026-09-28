import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Pencil } from "lucide-react";
import {
  getAllPackagingTypes,
  getProductCountsByPackagingType,
} from "@/lib/packaging-types-db";
import { getPackagingIcon } from "@/lib/packaging";
import { PackagingTypeDeleteButton } from "./packaging-type-delete-button";

export const metadata: Metadata = {
  title: "Types d'emballage — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPackagingTypesPage() {
  const [packagingTypes, productCounts] = await Promise.all([
    getAllPackagingTypes(),
    getProductCountsByPackagingType(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
          Types d&rsquo;emballage ({packagingTypes.length})
        </h1>
        <Link
          href="/admin/emballages/nouveau"
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          <Plus className="h-4 w-4" /> Nouveau type d&rsquo;emballage
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-xs font-bold uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Produits</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {packagingTypes.map((p) => {
              const Icon = getPackagingIcon(p.id);
              return (
                <tr key={p.id} className="border-b border-brand-green/5">
                  <td className="px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                      <Icon className="h-4 w-4" />
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-green-dark">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {productCounts[p.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/emballages/${p.id}`}
                        aria-label={`Modifier ${p.name}`}
                        className="rounded-full p-2 text-brand-green hover:bg-ivory"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <PackagingTypeDeleteButton id={p.id} name={p.name} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
