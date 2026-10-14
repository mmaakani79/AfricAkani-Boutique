import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products-db";
import { publiclyListed } from "@/lib/zone-visibility";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.africakani.com"
).replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalogue`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/notre-histoire`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/services`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // A product sold in no zone is not public: it must not be advertised to search engines.
  const productPages: MetadataRoute.Sitemap = publiclyListed(products).map((p) => ({
    url: `${SITE_URL}/produit/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...productPages];
}
