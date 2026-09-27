import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/products-db";
import { getApprovedReviewsForProduct } from "@/lib/reviews-db";
import { getCategoryById } from "@/data/categories";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { StarRatingDisplay } from "@/components/shop/star-rating";
import { PACKAGING_LABELS, HALAL_LABELS } from "@/lib/packaging";
import { ProductPurchasePanel } from "./purchase-panel";
import { Container } from "@/components/layout/container";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} — AfricAkani`,
    description: product.description,
    alternates: { canonical: `/produit/${product.slug}` },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = getCategoryById(product.categoryId);
  const relatedProducts = await getRelatedProducts(product.id, product.categoryId);
  const reviews = await getApprovedReviewsForProduct(product.id);

  return (
    <Container className="py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery
          name={product.name}
          image={product.image}
          galleryImages={product.galleryImages}
          videoUrl={product.videoUrl}
          halal={product.halal}
          placeholderSeed={category?.photoSeed ?? "emerald"}
          categoryId={category?.id}
        />

        <div>
          {category && (
            <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
              {category.name}
            </p>
          )}
          <h1 className="mt-1 font-brand text-3xl font-bold text-brand-green-dark">
            {product.name}
          </h1>
          {product.rating && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <StarRatingDisplay
                average={product.rating.average}
                count={product.rating.count}
                size="md"
              />
              {!!product.soldCount && (
                <span className="text-xs text-ink/50">· {product.soldCount} vendus</span>
              )}
            </div>
          )}
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">
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

      {product.longDescription && product.longDescription.trim() && (
        <div className="mt-10 rounded-2xl bg-white p-6">
          <h2 className="font-brand text-xl font-bold text-brand-green-dark">
            Description complète
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">
            {product.longDescription}
          </p>
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-brand text-xl font-bold text-brand-green-dark">
            Avis clients
          </h2>
          {product.rating && product.rating.count > 0 && (
            <StarRatingDisplay average={product.rating.average} count={product.rating.count} size="md" />
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-ink/50">
            Aucun avis publié pour ce produit pour le moment.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="border-t border-brand-green/10 pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brand-green-dark">
                    {review.customerName}
                  </span>
                  <StarRatingDisplay average={review.rating} count={1} showCount={false} />
                </div>
                <p className="mt-1 text-xs text-ink/40">
                  {new Date(review.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {review.comment && (
                  <p className="mt-2 whitespace-pre-line text-sm text-ink/70">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {relatedProducts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-brand text-xl font-bold text-brand-green-dark">
            Vous aimerez aussi
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
