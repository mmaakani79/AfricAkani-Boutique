"use client";

// Storefront blocks that only show what is sold in the visitor's zone. The zone
// lives in the browser (see zone-context), so the filtering happens here, on
// the full list the server sends: switching zone is instant and also works
// offline. A block with nothing to show in the zone disappears entirely.

import Link from "next/link";
import { useZone } from "@/context/zone-context";
import { visibleInZone } from "@/lib/zone-visibility";
import type { Category, PublicProduct, ZoneId } from "@/lib/types";
import { ProductCard } from "./product-card";
import { CategoryCard } from "./category-card";
import { Container } from "@/components/layout/container";

/** « Le meilleur de la maison » : the featured shelves that have at least one
 *  product sold in the zone. */
export function ZoneCategorySection({
  categories,
  zonesByCategory,
}: {
  categories: Category[];
  zonesByCategory: Record<string, ZoneId[]>;
}) {
  const { zoneId } = useZone();
  const visible = categories.filter((c) => zonesByCategory[c.id]?.includes(zoneId));
  if (visible.length === 0) return null;

  return (
    <div data-testid="home-categories">
      <Container className="pb-14 pt-16">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-brand-gold">
          Nos rayons phares
        </p>
        <h2 className="mt-2 text-center font-brand text-3xl font-bold text-brand-green-dark">
          Le meilleur de la maison
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>
    </div>
  );
}

/** « Produits mis en avant » : only those sold in the zone. */
export function ZoneFeaturedSection({ products }: { products: PublicProduct[] }) {
  const { zoneId } = useZone();
  const visible = visibleInZone(products, zoneId);
  if (visible.length === 0) return null;

  return (
    <section className="bg-white py-14" data-testid="home-featured">
      <Container>
        <p className="text-center text-xs font-bold uppercase tracking-widest text-brand-gold">
          Sélection
        </p>
        <h2 className="mt-2 text-center font-brand text-3xl font-bold text-brand-green-dark">
          Produits mis en avant
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/catalogue"
            className="rounded-full border border-brand-green px-6 py-3 text-sm font-bold text-brand-green hover:bg-brand-green hover:text-ivory"
          >
            Voir tout le catalogue →
          </Link>
        </div>
      </Container>
    </section>
  );
}

/** « Vous aimerez aussi » : suggestions limited to products sold in the zone. */
export function ZoneRelatedProducts({
  products,
  limit = 4,
}: {
  products: PublicProduct[];
  limit?: number;
}) {
  const { zoneId } = useZone();
  const visible = visibleInZone(products, zoneId).slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <div className="mt-10" data-testid="related-products">
      <h2 className="font-brand text-xl font-bold text-brand-green-dark">
        Vous aimerez aussi
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

