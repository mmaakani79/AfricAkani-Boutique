import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/products-db";
import { toPublicProduct } from "@/lib/public-product";
import { getApprovedReviewsForProduct } from "@/lib/reviews-db";
import { getCategoryById } from "@/lib/categories-db";
import { getPackagingTypeById } from "@/lib/packaging-types-db";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ZoneRelatedProducts } from "@/components/shop/zone-sections";
import { ProductZoneGate } from "./zone-gate";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { isSoldInAnyZone, publiclyListed } from "@/lib/zone-visibility";
import { StarRatingDisplay } from "@/components/shop/star-rating";
import { HALAL_LABELS } from "@/lib/packaging";
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
  // A product sold in no zone does not exist for the public: no title, no indexing.
  if (!product || !isSoldInAnyZone(product)) return { robots: { index: false, follow: false } };
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

  // Sold in no zone (no price anywhere): only the admin may open it, with a
  // clear warning. For everyone else it does not exist.
  const soldAnywhere = isSoldInAnyZone(product);
  const admin = soldAnywhere ? false : await isAdminAuthed();
  if (!soldAnywhere && !admin) notFound();

  const category = await getCategoryById(product.categoryId);
  const packagingType = await getPackagingTypeById(product.packaging);
  // A wider pool than shown: the visitor's zone is only known in the browser,
  // which keeps the first 4 sold in that zone (see ZoneRelatedProducts).
  const relatedProducts = publiclyListed(
    await getRelatedProducts(product.id, product.categoryId, 16)
  );
  const reviews = await getApprovedReviewsForProduct(product.id);

  return (
    <Container className="py-10">
      {admin && (
        <p
          role="note"
          data-testid="admin-hidden-product"
          className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          Aperçu administrateur : ce produit n&rsquo;a de prix dans aucune zone, il est
          invisible pour le public (boutique, recherche, accueil et lien direct).
        </p>
      )}
      <ProductZoneGate productName={product.name} prices={product.prices} bypass={admin}>
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
                {packagingType?.name ?? product.packaging}
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

          <ProductPurchasePanel product={toPublicProduct(product)} />
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

      </ProductZoneGate>

      <ZoneRelatedProducts products={relatedProducts.map(toPublicProduct)} />
    </Container>
  );
}
