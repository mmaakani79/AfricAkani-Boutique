"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { useZone } from "@/context/zone-context";
import { useCart } from "@/context/cart-context";
import { getCategoryById } from "@/data/categories";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PACKAGING_ICONS, PACKAGING_LABELS } from "@/lib/packaging";
import { PhotoPlaceholder } from "./photo-placeholder";
import { HalalBadge } from "./halal-badge";

export function ProductCard({ product }: { product: Product }) {
  const { priceFor, format } = useZone();
  const { addItem } = useCart();
  const category = getCategoryById(product.categoryId);
  const PackagingIcon = PACKAGING_ICONS[product.packaging];
  const CategoryIcon = category ? CATEGORY_ICONS[category.id] : undefined;
  const price = priceFor(product);
  const unavailable = price === null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-brand-green/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/produit/${product.slug}`}
        className="relative block aspect-square"
      >
        <PhotoPlaceholder
          seed={category?.photoSeed ?? "emerald"}
          icon={CategoryIcon}
          className="relative h-full w-full"
        />
        <div className="absolute right-2 top-2">
          <HalalBadge status={product.halal} />
        </div>
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-brand-green-dark">
          <PackagingIcon className="h-3 w-3" />
          <span className="hidden sm:inline">
            {PACKAGING_LABELS[product.packaging]}
          </span>
        </div>
        {product.stock !== "en_stock" && (
          <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[11px] font-semibold text-white">
            {product.stock === "rupture" ? "Rupture de stock" : "Stock limité"}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
          {category?.name}
        </p>
        <Link
          href={`/produit/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold text-brand-green-dark hover:text-brand-green"
        >
          {product.name}
        </Link>
        <div className="mt-auto flex items-center justify-between pt-2">
          {unavailable ? (
            <span className="text-xs font-semibold text-ink/50">
              Non disponible dans cette zone
            </span>
          ) : (
            <>
              <span className="font-brand text-base font-bold text-ink">
                {format(price)}
              </span>
              <button
                type="button"
                onClick={() => addItem(product)}
                disabled={product.stock === "rupture"}
                className="flex items-center gap-1 rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-ivory transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:bg-ink/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
