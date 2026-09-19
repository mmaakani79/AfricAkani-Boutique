import type { Category } from "@/lib/types";

export const CATEGORIES: Category[] = [
  {
    id: "huiles-cosmetiques",
    slug: "huiles-cosmetiques-naturels",
    name: "Huiles & Cosmétiques naturels",
    description: "Karité, argan, coco, savon noir — la beauté à l'état pur.",
    featuredHome: true,
    photoSeed: "amber",
  },
  {
    id: "tisanes-infusions",
    slug: "tisanes-infusions",
    name: "Tisanes & Infusions",
    description: "Gingembre-citron, moringa, bissap, citronnelle.",
    featuredHome: true,
    photoSeed: "emerald",
  },
  {
    id: "epices-poudres",
    slug: "epices-poudres",
    name: "Épices & Poudres",
    description: "Moringa, baobab, curcuma, poivre de Guinée.",
    featuredHome: true,
    photoSeed: "sienna",
  },
  {
    id: "miel-ruche",
    slug: "miel-produits-de-la-ruche",
    name: "Miel & Produits de la ruche",
    description: "Miel pur, propolis, pollen — le meilleur de la ruche.",
    featuredHome: true,
    photoSeed: "gold",
  },
  {
    id: "complements-naturels",
    slug: "complements-naturels",
    name: "Compléments naturels",
    description: "Gélules de moringa, sirops et huiles essentielles.",
    photoSeed: "moss",
  },
  {
    id: "cereales-produits-secs",
    slug: "cereales-produits-secs",
    name: "Céréales & Produits secs",
    description: "Sésame, arachides, gari, farine de baobab.",
    photoSeed: "wheat",
  },
  {
    id: "alimentation-generale",
    slug: "alimentation-generale",
    name: "Alimentation générale",
    description: "Riz, huiles, sucre, café, thé et essentiels du quotidien.",
    featuredHome: true,
    photoSeed: "clay",
  },
  {
    id: "produits-frais",
    slug: "produits-frais-marche",
    name: "Produits frais / marché",
    description: "Légumes, fruits de saison, poisson fumé et séché.",
    photoSeed: "leaf",
  },
  {
    id: "hygiene-entretien",
    slug: "hygiene-entretien",
    name: "Hygiène & entretien",
    description: "Savons, dentifrice, détergents et entretien du foyer.",
    photoSeed: "sand",
  },
  {
    id: "beaute-soins",
    slug: "beaute-soins",
    name: "Beauté & soins",
    description: "Crèmes, huiles capillaires, parfums.",
    featuredHome: true,
    photoSeed: "rose",
  },
  {
    id: "electronique-accessoires",
    slug: "electronique-accessoires",
    name: "Électronique & accessoires",
    description: "Recharges, piles, chargeurs, lampes solaires.",
    photoSeed: "slate",
  },
  {
    id: "textile-accessoires",
    slug: "textile-accessoires",
    name: "Textile & accessoires",
    description: "Pagnes wax, prêt-à-porter, sacs et chaussures.",
    featuredHome: true,
    photoSeed: "indigo",
  },
  {
    id: "articles-menagers",
    slug: "articles-menagers",
    name: "Articles ménagers",
    description: "Ustensiles, bassines, marmites, nattes.",
    photoSeed: "copper",
  },
  {
    id: "equipements-sportifs",
    slug: "equipements-sportifs-accessoires",
    name: "Équipements sportifs & accessoires",
    description: "Ballons, tenues, chaussures de sport, sacs de sport.",
    photoSeed: "forest",
  },
  {
    id: "materiel-elevage",
    slug: "materiel-elevage-volaille",
    name: "Matériel d'élevage de volaille",
    description: "Incubateurs, éleveuses, mangeoires, abreuvoirs.",
    photoSeed: "straw",
  },
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
