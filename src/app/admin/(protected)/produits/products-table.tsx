"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "@/components/shop/photo-placeholder";
import { formatPrice } from "@/data/zones";
import { deleteProductAction, reorderProductsAction } from "../../actions";

export function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const [items, setItems] = useState(products);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setItems((prev) => {
      const dragIndex = prev.findIndex((p) => p.id === draggingId);
      const overIndex = prev.findIndex((p) => p.id === overId);
      if (dragIndex === -1 || overIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    setDraggingId(null);
    setError(null);
    setSaved(false);
    const orderedIds = items.map((p) => p.id);
    startTransition(async () => {
      const result = await reorderProductsAction(orderedIds);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex min-h-[20px] items-center gap-2 text-xs font-semibold">
        {pending && <span className="text-ink/50">Enregistrement de l&rsquo;ordre…</span>}
        {!pending && saved && <span className="text-brand-green-dark">Ordre enregistré ✓</span>}
        {!pending && error && <span className="text-red-600">{error}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-xs font-bold uppercase tracking-wider text-ink/50">
              <th className="px-2 py-3" />
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix (Bénin)</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Vedette</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const category = categoryById.get(p.categoryId);
              const CategoryIcon = category ? CATEGORY_ICONS[category.id] : undefined;
              return (
                <tr
                  key={p.id}
                  onDragOver={(e) => handleDragOver(e, p.id)}
                  onDrop={(e) => e.preventDefault()}
                  className={`border-b border-brand-green/5 ${
                    draggingId === p.id ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-2 py-3">
                    <span
                      draggable
                      onDragStart={() => setDraggingId(p.id)}
                      onDragEnd={handleDragEnd}
                      aria-label={`Réorganiser ${p.name}`}
                      className="flex cursor-grab items-center justify-center text-ink/30 hover:text-ink/60 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <PhotoPlaceholder
                        seed={category?.photoSeed ?? "emerald"}
                        icon={CategoryIcon}
                        className="relative h-10 w-10 rounded-lg"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-green-dark">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {category?.name ?? p.categoryId}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {p.prices.bj === null ? "Non vendu" : formatPrice(p.prices.bj, "bj")}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {p.stock === "en_stock" && "En stock"}
                    {p.stock === "stock_limite" && "Stock limité"}
                    {p.stock === "rupture" && "Rupture"}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{p.featured ? "Oui" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/produits/${p.id}`}
                        aria-label={`Modifier ${p.name}`}
                        className="rounded-full p-2 text-brand-green hover:bg-ivory"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <form action={deleteProductAction.bind(null, p.id)}>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
