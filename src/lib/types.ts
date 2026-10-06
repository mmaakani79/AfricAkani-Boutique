export type ZoneId = "bj" | "ca" | "us";

export type HalalStatus = "oui" | "a_verifier" | "n/a";

export type StockStatus = "en_stock" | "stock_limite" | "rupture";

/** References a row in the DB-backed, admin-managed `packaging_types`
 *  table (see packaging-types-db.ts) — free-form now rather than a fixed
 *  union, so the admin can add their own types without a code change. */
export type PackagingType = string;

export interface PackagingTypeRecord {
  id: string;
  name: string;
}

export interface Zone {
  id: ZoneId;
  label: string;
  shortLabel: string;
  currency: "FCFA" | "CAD" | "USD";
  freeShippingThreshold: number;
  regionDescription: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  featuredHome?: boolean;
  photoSeed: string;
  /** Uploaded cover photo. When unset, the card falls back to a photoSeed gradient. */
  image?: string;
}

/** One selectable option a product's variants are built from (e.g. name
 *  "Taille", values ["S","M","L","XL"]). */
export interface VariantOption {
  name: string;
  values: string[];
}

/** One buyable combination of the product's variant options (e.g.
 *  { Taille: "M", Couleur: "Rouge" }), with its own SKU and stock status. */
export interface ProductVariant {
  id: string;
  attributes: Record<string, string>;
  sku: string;
  stock: StockStatus;
}

/** A volume-pricing step: `price` per unit once quantity reaches `minQty`.
 *  `minQty: 1` is always the product's base per-zone price and is never
 *  stored as a tier itself — only steps above it (minQty > 1) live here. */
export interface PriceTier {
  minQty: number;
  price: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  halal: HalalStatus;
  unit: string;
  packaging: PackagingType;
  description: string;
  /** Longer write-up shown in its own "Description complète" section on the product page. */
  longDescription?: string;
  /** null for a zone means "not sold in that zone". */
  prices: Record<ZoneId, number | null>;
  /** Extra quantity-price steps per zone, beyond the base price above (minQty > 1 only). */
  priceTiers?: Partial<Record<ZoneId, PriceTier[]>>;
  stock: StockStatus;
  featured?: boolean;
  /** Internal catalog code. Admin-only — never rendered to customers. */
  sku?: string;
  supplier?: string;
  image?: string;
  /** Extra photos shown in the product page gallery, beyond the cover `image`. */
  galleryImages?: string[];
  /** A single product video, played inline in the gallery. */
  videoUrl?: string;
  /** Selectable option definitions (Taille, Couleur, …) this product's variants are built from. */
  variantOptions?: VariantOption[];
  /** Buyable combinations of the options above, each with its own SKU and stock. Empty/absent means the product has no variants. */
  variants?: ProductVariant[];
  /** Computed from approved reviews — undefined when the query didn't join it (e.g. admin edit form). */
  rating?: { average: number; count: number };
  /** Total quantity sold across paid orders — undefined when the query didn't join it. */
  soldCount?: number;
}

/** A variant as the public storefront sees it: no SKU (supplier reference). */
export type PublicProductVariant = Omit<ProductVariant, "sku">;

/** A product as sent to the browser. The SKU, the supplier and every variant's
 *  SKU are internal: anything rendered by a public page — including props
 *  handed to client components, which end up in the page source — must be a
 *  PublicProduct, built with toPublicProduct(). */
export type PublicProduct = Omit<Product, "sku" | "supplier" | "variants"> & {
  variants?: PublicProductVariant[];
};
