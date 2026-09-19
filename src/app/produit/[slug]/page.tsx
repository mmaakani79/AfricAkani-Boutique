import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PRODUCTS, getProductBySlug } from "@/data/products";
import { getCategoryById } from "@/data/categories";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "@/components/shop/photo-placeholder";
import { HalalBadge } from "@/components/shop/halal-badge";
import { PACKAGING_LABELS, HALAL_LABELS } from "@/lib/packaging";
import { ProductPurchasePanel } from "./purchase-panel";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} — AfricAkani`,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const category = getCategoryById(product.categoryId);
  const CategoryIcon = category ? CATEGORY_ICONS[category.id] : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl">
          <PhotoPlaceholder
            seed={category?.photoSeed ?? "emerald"}
            icon={CategoryIcon}
            className="h-full w-full"
          />
          <div className="absolute right-3 top-3">
            <HalalBadge status={product.halal} />
          </div>
        </div>

        <div>
          {category && (
            <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
              {category.name}
            </p>
          )}
          <h1 className="mt-1 font-brand text-3xl font-bold text-brand-green-dark">
            {product.name}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            {product.description}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-4 text-sm">
            <div>
              <dt className="text-ink/50">Unité de vente</dt>
              <dd className="font-semibold text-brand-green-dark">
                {product.unit}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Emballage</dt>
              <dd className="font-semibold text-brand-green-dark">
                {PACKAGING_LABELS[product.packaging]}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Statut halal</dt>
              <dd className="font-semibold text-brand-green-dark">
                {HALAL_LABELS[product.halal]}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Disponibilité</dt>
              <dd className="font-semibold text-brand-green-dark">
                {product.stock === "en_stock" && "En stock"}
                {product.stock === "stock_limite" && "Stock limité"}
                {product.stock === "rupture" && "Rupture de stock"}
              </dd>
            </div>
          </dl>

          <ProductPurchasePanel product={product} />
        </div>
      </div>
    </div>
  );
}
