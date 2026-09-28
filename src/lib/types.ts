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
  /** Computed from approved reviews — undefined when the query didn't join it (e.g. admin edit form). */
  rating?: { average: number; count: number };
  /** Total quantity sold across paid orders — undefined when the query didn't join it. */
  soldCount?: number;
}
