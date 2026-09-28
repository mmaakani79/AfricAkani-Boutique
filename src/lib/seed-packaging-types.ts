import type { PackagingTypeRecord } from "./types";

/** One-time seed for the `packaging_types` table — the admin can rename,
 *  add, or remove types afterward from /admin/emballages. The first 12
 *  ids are the original hardcoded set (kept so existing products' stored
 *  `packaging` id keeps resolving to a name); the last two are the new
 *  defaults requested alongside making this admin-editable. */
export const SEED_PACKAGING_TYPES: PackagingTypeRecord[] = [
  { id: "carton_boite", name: "Boîte en carton" },
  { id: "bouteille_pet", name: "Bouteille en plastique" },
  { id: "sachet_doypack", name: "Sachet zip" },
  { id: "flacon_verre", name: "Flacon en verre" },
  { id: "sachet_plastique_transparent", name: "Sachet plastique transparent" },
  { id: "sachet_opaque", name: "Sachet noir / opaque" },
  { id: "sachet_kraft", name: "Sachet biodégradable / kraft" },
  { id: "bidon_jerrican", name: "Bidon / jerrican" },
  { id: "pot_plastique", name: "Pot plastique avec couvercle" },
  { id: "panier_raphia", name: "Panier en raphia" },
  { id: "pagne_tissu", name: "Pagne / tissu emballant" },
  { id: "vrac", name: "Vente en vrac" },
  { id: "boite_metallique", name: "Boîte métallique" },
  { id: "emballage_sous_vide", name: "Emballage sous vide" },
];
