import {
  Package,
  PackageOpen,
  PackageCheck,
  Box,
  FlaskConical,
  Droplet,
  Container,
  ShoppingBasket,
  Shirt,
  Scale,
  type LucideIcon,
} from "lucide-react";

// Decorative icons for the packaging types seeded by default (see
// seed-packaging-types.ts) — purely cosmetic, keyed by id. A packaging type
// the admin creates later (or any id not listed here) falls back to the
// generic Package icon via getPackagingIcon() below.
export const PACKAGING_ICONS: Record<string, LucideIcon> = {
  sachet_plastique_transparent: Package,
  sachet_opaque: Package,
  sachet_kraft: PackageOpen,
  bouteille_pet: Droplet,
  bidon_jerrican: Container,
  pot_plastique: PackageOpen,
  flacon_verre: FlaskConical,
  carton_boite: Box,
  sachet_doypack: PackageCheck,
  panier_raphia: ShoppingBasket,
  pagne_tissu: Shirt,
  vrac: Scale,
  boite_metallique: Box,
  emballage_sous_vide: PackageCheck,
};

export function getPackagingIcon(id: string): LucideIcon {
  return PACKAGING_ICONS[id] ?? Package;
}

export const HALAL_LABELS: Record<string, string> = {
  oui: "Halal vérifié",
  a_verifier: "À vérifier",
  "n/a": "Non applicable",
};
