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
import type { PackagingType } from "./types";

export const PACKAGING_LABELS: Record<PackagingType, string> = {
  sachet_plastique_transparent: "Sachet plastique transparent",
  sachet_opaque: "Sachet noir / opaque",
  sachet_kraft: "Sachet biodégradable / kraft",
  bouteille_pet: "Bouteille PET",
  bidon_jerrican: "Bidon / jerrican",
  pot_plastique: "Pot plastique avec couvercle",
  flacon_verre: "Flacon en verre",
  carton_boite: "Carton / boîte",
  sachet_doypack: "Sachet doypack (avec zip)",
  panier_raphia: "Panier en raphia",
  pagne_tissu: "Pagne / tissu emballant",
  vrac: "Vente en vrac",
};

export const PACKAGING_ICONS: Record<PackagingType, LucideIcon> = {
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
};

export const HALAL_LABELS: Record<string, string> = {
  oui: "Halal vérifié",
  a_verifier: "À vérifier",
  "n/a": "Non applicable",
};
