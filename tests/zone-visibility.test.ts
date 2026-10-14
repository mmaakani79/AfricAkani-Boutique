// Visibilité des produits par zone : un produit n'est visible et commandable que dans les zones
// où il a un prix. Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  categoryZones,
  isSoldInAnyZone,
  isSoldInZone,
  publiclyListed,
  splitCartByZone,
  visibleInZone,
  zonesSoldIn,
} from "@/lib/zone-visibility";
import { priceForQuantity } from "@/lib/price-tiers";
import type { PublicProduct, ZoneId } from "@/lib/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const p = (id: string, categoryId: string, bj: number | null, ca: number | null, us: number | null) => ({
  id,
  categoryId,
  name: `Produit ${id}`,
  prices: { bj, ca, us } as Record<ZoneId, number | null>,
});

const PRODUCTS = [
  p("tous", "epices", 1000, 5, 6), //   vendu partout
  p("afrique", "epices", 2000, null, null), // Bénin seulement
  p("nord", "tech", null, 20, 22), //     Amérique du Nord seulement (ex. produit CJ)
  p("canada", "tech", null, 30, null), // Canada seulement
  p("nulle-part", "tech", null, null, null), // aucun prix : invisible pour le public
];

const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("règle : vendu dans une zone = prix renseigné", () => {
  it("isSoldInZone / zonesSoldIn", () => {
    assert.ok(isSoldInZone(PRODUCTS[1], "bj"));
    assert.ok(!isSoldInZone(PRODUCTS[1], "ca"));
    assert.deepEqual(zonesSoldIn(PRODUCTS[0]), ["bj", "ca", "us"]);
    assert.deepEqual(zonesSoldIn(PRODUCTS[2]), ["ca", "us"]);
    assert.deepEqual(zonesSoldIn(PRODUCTS[4]), []);
    assert.ok(!isSoldInAnyZone(PRODUCTS[4]));
  });

  it("un prix de 0 est un prix (vendu), seul « vide » veut dire non vendu", () => {
    assert.ok(isSoldInZone(p("gratuit", "x", 0, null, null), "bj"));
  });

  it("c'est exactement la règle du serveur : visible ⇔ commandable (prix non nul)", () => {
    for (const product of PRODUCTS) {
      for (const zone of ["bj", "ca", "us"] as ZoneId[]) {
        const asPublic = product as unknown as PublicProduct;
        assert.equal(isSoldInZone(product, zone), priceForQuantity(asPublic, zone, 1) !== null, `${product.id}/${zone}`);
      }
    }
  });
});

describe("listes par zone : masqué dans une zone, visible dans l'autre", () => {
  it("Bénin", () => assert.deepEqual(ids(visibleInZone(PRODUCTS, "bj")), ["tous", "afrique"]));
  it("Canada", () => assert.deepEqual(ids(visibleInZone(PRODUCTS, "ca")), ["tous", "nord", "canada"]));
  it("États-Unis", () => assert.deepEqual(ids(visibleInZone(PRODUCTS, "us")), ["tous", "nord"]));

  it("un produit réservé au Bénin est caché au Canada, un produit nord-américain est caché au Bénin", () => {
    assert.ok(!ids(visibleInZone(PRODUCTS, "ca")).includes("afrique"));
    assert.ok(!ids(visibleInZone(PRODUCTS, "bj")).includes("nord"));
  });

  it("un produit sans prix nulle part n'est dans aucune zone ni dans la liste publique", () => {
    for (const zone of ["bj", "ca", "us"] as ZoneId[]) assert.ok(!ids(visibleInZone(PRODUCTS, zone)).includes("nulle-part"));
    assert.deepEqual(ids(publiclyListed(PRODUCTS)), ["tous", "afrique", "nord", "canada"]);
  });

  it("les compteurs affichés = les produits réellement visibles", () => {
    assert.equal(visibleInZone(PRODUCTS, "bj").length, 2);
    assert.equal(visibleInZone(PRODUCTS, "ca").length, 3);
    assert.equal(visibleInZone(PRODUCTS, "us").length, 2);
  });
});

describe("catégories (rayons phares, filtres du catalogue)", () => {
  it("une catégorie n'existe dans une zone que si un de ses produits y est vendu", () => {
    const zones = categoryZones(publiclyListed(PRODUCTS));
    assert.deepEqual(zones.epices, ["bj", "ca", "us"]);
    assert.deepEqual(zones.tech, ["ca", "us"]);
  });

  it("une catégorie dont les seuls produits n'ont aucun prix disparaît partout", () => {
    const only = [p("a", "fantome", null, null, null)];
    assert.deepEqual(categoryZones(publiclyListed(only)), {});
  });
});

describe("panier : jamais de produit non vendu dans la zone choisie", () => {
  const line = (product: ReturnType<typeof p>, quantity = 1) => ({ product, quantity });

  it("changer de zone retire les produits non vendus et garde les autres", () => {
    const cart = [line(PRODUCTS[0], 2), line(PRODUCTS[1]), line(PRODUCTS[2])];
    const toCanada = splitCartByZone(cart, "ca");
    assert.deepEqual(toCanada.kept.map((l) => l.product.id), ["tous", "nord"]);
    assert.deepEqual(toCanada.removed.map((l) => l.product.id), ["afrique"]);
    const toBenin = splitCartByZone(cart, "bj");
    assert.deepEqual(toBenin.kept.map((l) => l.product.id), ["tous", "afrique"]);
    assert.deepEqual(toBenin.removed.map((l) => l.product.id), ["nord"]);
  });

  it("un panier entièrement vendu dans la zone n'est pas touché", () => {
    const cart = [line(PRODUCTS[0]), line(PRODUCTS[2])];
    assert.deepEqual(splitCartByZone(cart, "us").removed, []);
  });

  it("les quantités sont conservées pour les lignes gardées", () => {
    const { kept } = splitCartByZone([line(PRODUCTS[0], 7)], "bj");
    assert.equal(kept[0].quantity, 7);
  });
});

describe("pages : le branchement est bien en place", () => {
  it("catalogue : filtre par zone AVANT la recherche, les catégories et le compteur", () => {
    const code = read("src/app/catalogue/catalogue-client.tsx");
    assert.match(code, /const inZone = useMemo\(\(\) => visibleInZone\(products, zoneId\)/);
    assert.match(code, /return inZone\.filter\(\(p\) =>/);
    assert.match(code, /visibleCategories\.map\(\(c\) =>/);
    assert.match(code, /\{filtered\.length\} produit/);
    const page = read("src/app/catalogue/page.tsx");
    assert.match(page, /publiclyListed\(products\)\.map\(toPublicProduct\)/);
  });

  it("accueil : produits mis en avant et rayons phares filtrés par zone, produits sans prix exclus", () => {
    const home = read("src/app/page.tsx");
    assert.match(home, /publiclyListed\(await getAllProducts\(\)\)/);
    assert.match(home, /<ZoneCategorySection/);
    assert.match(home, /<ZoneFeaturedSection/);
    const sections = read("src/components/shop/zone-sections.tsx");
    assert.match(sections, /zonesByCategory\[c\.id\]\?\.includes\(zoneId\)/);
    assert.match(sections, /visibleInZone\(products, zoneId\)/);
  });

  it("suggestions « Vous aimerez aussi » : seulement des produits vendus dans la zone", () => {
    const page = read("src/app/produit/[slug]/page.tsx");
    assert.match(page, /publiclyListed\(\s*await getRelatedProducts/);
    assert.match(page, /<ZoneRelatedProducts/);
    assert.ok(!/<ProductCard/.test(page), "plus de liste de suggestions non filtrée");
  });

  it("fiche produit : un produit sans prix nulle part n'existe pas pour le public (404), seul l'admin le voit, avec un avertissement", () => {
    const page = read("src/app/produit/[slug]/page.tsx");
    assert.match(page, /if \(!soldAnywhere && !admin\) notFound\(\)/);
    assert.match(page, /isAdminAuthed\(\)/);
    assert.match(page, /data-testid="admin-hidden-product"/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
  });

  it("fiche produit : lien direct hors zone = message « Non disponible dans votre zone » + changer de zone + retour boutique", () => {
    const gate = read("src/app/produit/[slug]/zone-gate.tsx");
    assert.match(gate, /Non disponible dans votre zone/);
    assert.match(gate, /Passer à la zone/);
    assert.match(gate, /Retourner à la boutique/);
    assert.match(gate, /href="\/catalogue"/);
    assert.match(read("src/app/produit/[slug]/page.tsx"), /<ProductZoneGate/);
  });

  it("sitemap : les produits sans prix nulle part n'y figurent pas", () => {
    assert.match(read("src/app/sitemap.ts"), /publiclyListed\(products\)\.map/);
  });

  it("admin : indication claire pour un produit invisible en boutique", () => {
    const table = read("src/app/admin/(protected)/produits/products-table.tsx");
    assert.match(table, /Invisible en boutique : aucun prix dans aucune zone/);
  });

  it("panier : nettoyé au changement de zone, après lecture de la zone mémorisée, avec un message", () => {
    const cart = read("src/context/cart-context.tsx");
    assert.match(cart, /if \(!hydrated \|\| !zoneHydrated\) return;/);
    assert.match(cart, /splitCartByZone\(lines, zoneId\)/);
    assert.match(cart, /if \(!isSoldInZone\(product, zoneId\)\) return;/);
    assert.match(read("src/context/zone-context.tsx"), /setZoneHydrated\(true\)/);
    assert.match(read("src/app/panier/page.tsx"), /<CartZoneNotice \/>/);
    assert.match(read("src/app/commande/page.tsx"), /<CartZoneNotice \/>/);
  });
});
