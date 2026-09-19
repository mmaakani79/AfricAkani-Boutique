export type ZoneId = "bj" | "ca" | "us";

export type HalalStatus = "oui" | "a_verifier" | "n/a";

export type StockStatus = "en_stock" | "stock_limite" | "rupture";

export type PackagingType =
  | "sachet_plastique_transparent"
  | "sachet_opaque"
  | "sachet_kraft"
  | "bouteille_pet"
  | "bidon_jerrican"
  | "pot_plastique"
  | "flacon_verre"
  | "carton_boite"
  | "sachet_doypack"
  | "panier_raphia"
  | "pagne_tissu"
  | "vrac";

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

export interface Product {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  halal: HalalStatus;
  unit: string;
  packaging: PackagingType;
  description: string;
  prices: Record<ZoneId, number>;
  stock: StockStatus;
  featured?: boolean;
}
