// "Le prix a changé" : ce que le client voit (prix gardés dans le panier) contre
// ce que le serveur facturerait maintenant. Lancer avec `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewCart } from "@/lib/order-pricing";
import { detectPriceChange, type DisplayedPrices } from "@/lib/price-change";
import { priceForQuantity } from "@/lib/price-tiers";
import { computeShippingFee } from "@/lib/shipping-calc";
import type { ShippingSettings } from "@/lib/shipping-types";
import type { Product, ZoneId } from "@/lib/types";

function makeProduct(over: Partial<Product> & { id: string }): Product {
  return {
    slug: over.id,
    name: `Produit ${over.id}`,
    categoryId: "epices",
    halal: "oui",
    unit: "sachet",
    packaging: "sachet_kraft",
    description: "",
    prices: { bj: 1000, ca: 10, us: 10 },
    stock: "en_stock",
    ...over,
  };
}

const SHIPPING: Record<ZoneId, ShippingSettings> = {
  bj: { zoneId: "bj", freeShippingThreshold: 25000, shippingFee: 1500, minOrderAmount: null },
  ca: { zoneId: "ca", freeShippingThreshold: 50, shippingFee: 8.99, minOrderAmount: null },
  us: { zoneId: "us", freeShippingThreshold: 55, shippingFee: 9.5, minOrderAmount: null },
};

// Le catalogue tel qu'il était quand le client a rempli son panier.
const WAS = [
  makeProduct({ id: "karite", name: "Beurre de karité", prices: { bj: 3000, ca: 20, us: 20 } }),
  makeProduct({ id: "bissap", name: "Bissap", prices: { bj: 1800, ca: 6.99, us: 6.99 } }),
];

type Line = { productId: string; variantId?: string | null; quantity: number };

/** Ce que l'écran affiche : calculé comme la page de commande (prix du panier, règle de livraison chargée avec la page). */
function displayed(zoneId: ZoneId, lines: Line[], catalog: Product[] = WAS, shipping = SHIPPING[zoneId]): DisplayedPrices {
  const items = lines.map((l) => {
    const product = catalog.find((p) => p.id === l.productId)!;
    return {
      productId: l.productId,
      variantId: l.variantId ?? null,
      name: product.name,
      unitPrice: priceForQuantity(product, zoneId, l.quantity) ?? 0,
      quantity: l.quantity,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const fee = computeShippingFee(subtotal, shipping);
  return { zoneId, items, shippingFee: fee, total: subtotal + fee };
}

/** Ce que le serveur calcule maintenant, d'après le catalogue actuel. */
function check(zoneId: ZoneId, lines: Line[], now: Product[], shippingNow = SHIPPING[zoneId], shown = displayed(zoneId, lines)) {
  const preview = previewCart({
    zoneId,
    lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity })),
    products: new Map(now.map((p) => [p.id, p])),
    shipping: shippingNow,
  });
  return detectPriceChange(shown, preview);
}

const withPrice = (id: string, zone: ZoneId, price: number | null) =>
  WAS.map((p) => (p.id === id ? { ...p, prices: { ...p.prices, [zone]: price } } : p));

const CART: Line[] = [
  { productId: "karite", quantity: 2 },
  { productId: "bissap", quantity: 1 },
];

describe("prix inchangé", () => {
  it("aucun écran : parcours inchangé, dans les trois zones", () => {
    for (const zone of ["bj", "ca", "us"] as ZoneId[]) {
      assert.equal(check(zone, CART, WAS), null, zone);
    }
  });

  it("des centimes d'arrondi flottant ne déclenchent rien", () => {
    // 3 × 6,99 ne tombe pas juste en virgule flottante : toujours « inchangé ».
    assert.equal(check("ca", [{ productId: "bissap", quantity: 3 }], WAS), null);
  });
});

describe("prix en hausse", () => {
  it("signale le produit, l'ancien prix, le nouveau prix et le nouveau total", () => {
    const report = check("ca", CART, withPrice("karite", "ca", 22.5));
    assert.ok(report);
    assert.equal(report.lines.length, 1);
    assert.deepEqual(
      { id: report.lines[0].productId, kind: report.lines[0].kind, old: report.lines[0].oldUnitPrice, now: report.lines[0].newUnitPrice, qty: report.lines[0].quantity },
      { id: "karite", kind: "price", old: 20, now: 22.5, qty: 2 }
    );
    // 2 × 22,50 + 6,99 = 51,99 → livraison offerte (seuil 50)
    assert.equal(report.oldTotal, 2 * 20 + 6.99 + 8.99);
    assert.equal(report.newTotal, 51.99);
    assert.equal(report.hasUnavailable, false);
  });

  it("en FCFA aussi", () => {
    const report = check("bj", CART, withPrice("karite", "bj", 3200));
    assert.ok(report);
    assert.equal(report.lines[0].oldUnitPrice, 3000);
    assert.equal(report.lines[0].newUnitPrice, 3200);
    assert.equal(report.newTotal, 2 * 3200 + 1800 + 1500);
  });
});

describe("prix en baisse", () => {
  it("signale la baisse avec le nouveau total", () => {
    const report = check("ca", CART, withPrice("karite", "ca", 15));
    assert.ok(report);
    assert.equal(report.lines[0].oldUnitPrice, 20);
    assert.equal(report.lines[0].newUnitPrice, 15);
    // 2 × 15 + 6,99 = 36,99 + livraison 8,99
    assert.equal(report.newTotal, 45.98);
  });
});

describe("plusieurs produits dont un seul change", () => {
  it("ne liste que le produit modifié", () => {
    const report = check("us", CART, withPrice("bissap", "us", 7.49));
    assert.ok(report);
    assert.deepEqual(report.lines.map((l) => l.productId), ["bissap"]);
    assert.equal(report.lines[0].oldUnitPrice, 6.99);
    assert.equal(report.lines[0].newUnitPrice, 7.49);
  });

  it("fournit les données fraîches de tous les produits, sans référence interne", () => {
    const report = check("us", CART, withPrice("bissap", "us", 7.49));
    assert.ok(report);
    assert.deepEqual(report.products.map((p) => p.id).sort(), ["bissap", "karite"]);
    assert.ok(!("sku" in report.products[0]) && !("supplier" in report.products[0]));
  });

  it("un palier de quantité qui change est détecté aussi", () => {
    const was = [makeProduct({ id: "t", prices: { bj: 100, ca: 10, us: 10 }, priceTiers: { ca: [{ minQty: 10, price: 8 }] } })];
    const now = [{ ...was[0], priceTiers: { ca: [{ minQty: 10, price: 7 }] } }];
    const lines = [{ productId: "t", quantity: 10 }];
    const report = check("ca", lines, now, SHIPPING.ca, displayed("ca", lines, was));
    assert.ok(report);
    assert.equal(report.lines[0].oldUnitPrice, 8);
    assert.equal(report.lines[0].newUnitPrice, 7);
  });
});

describe("livraison et seuil de livraison offerte", () => {
  it("la hausse fait atteindre le seuil : la livraison devient gratuite", () => {
    // Avant : 2 × 20 + 6,99 = 46,99 (< 50) → livraison 8,99. Après : 51,99 → gratuite.
    const report = check("ca", CART, withPrice("karite", "ca", 22.5));
    assert.ok(report);
    assert.equal(report.oldShippingFee, 8.99);
    assert.equal(report.newShippingFee, 0);
  });

  it("la baisse fait passer sous le seuil : la livraison redevient payante", () => {
    // Avant : 2 × 25 + 6,99 = 56,99 (≥ 50) → gratuite. Après : 2 × 20 + 6,99 = 46,99 → 8,99.
    const was = withPrice("karite", "ca", 25);
    const report = check("ca", CART, WAS, SHIPPING.ca, displayed("ca", CART, was));
    assert.ok(report);
    assert.equal(report.oldShippingFee, 0);
    assert.equal(report.newShippingFee, 8.99);
    assert.equal(report.newTotal, 55.98);
  });

  it("seuil exact : 50,00 est gratuit, 49,99 est payant", () => {
    const one = [makeProduct({ id: "s", prices: { bj: 1, ca: 49.99, us: 1 } })];
    const lines = [{ productId: "s", quantity: 1 }];
    const up = [{ ...one[0], prices: { ...one[0].prices, ca: 50 } }];
    const report = check("ca", lines, up, SHIPPING.ca, displayed("ca", lines, one));
    assert.ok(report);
    assert.equal(report.oldShippingFee, 8.99);
    assert.equal(report.newShippingFee, 0);
    assert.equal(report.newTotal, 50);
  });

  it("les frais ou le seuil modifiés dans Réglages, sans changement de prix, sont signalés aussi", () => {
    const report = check("ca", CART, WAS, { ...SHIPPING.ca, shippingFee: 12.5 });
    assert.ok(report);
    assert.equal(report.lines.length, 0);
    assert.equal(report.oldShippingFee, 8.99);
    assert.equal(report.newShippingFee, 12.5);
    assert.equal(report.shipping.shippingFee, 12.5);

    const lowerThreshold = check("ca", CART, WAS, { ...SHIPPING.ca, freeShippingThreshold: 40 });
    assert.ok(lowerThreshold);
    assert.equal(lowerThreshold.newShippingFee, 0);
  });
});

describe("produit devenu indisponible", () => {
  it("produit retiré de la boutique", () => {
    const report = check("ca", CART, WAS.filter((p) => p.id !== "karite"));
    assert.ok(report);
    assert.equal(report.hasUnavailable, true);
    assert.equal(report.newTotal, null);
    const line = report.lines.find((l) => l.productId === "karite")!;
    assert.equal(line.kind, "unavailable");
    assert.equal(line.name, "Beurre de karité"); // le nom affiché est conservé
    assert.equal(line.oldUnitPrice, 20);
    assert.equal(line.newUnitPrice, null);
    assert.match(line.reason!, /n'existe plus/);
  });

  it("rupture de stock", () => {
    const report = check("ca", CART, WAS.map((p) => (p.id === "bissap" ? { ...p, stock: "rupture" as const } : p)));
    assert.ok(report);
    assert.equal(report.lines[0].kind, "unavailable");
    assert.match(report.lines[0].reason!, /rupture de stock/);
  });

  it("n'est plus vendu dans la zone", () => {
    const report = check("us", CART, withPrice("bissap", "us", null));
    assert.ok(report);
    assert.equal(report.hasUnavailable, true);
    assert.match(report.lines[0].reason!, /pas vendu dans cette zone/);
  });

  it("indisponible + prix modifié : les deux sont listés, pas de nouveau total", () => {
    const now = withPrice("karite", "ca", 22.5).filter((p) => p.id !== "bissap");
    const report = check("ca", CART, now);
    assert.ok(report);
    assert.deepEqual(report.lines.map((l) => [l.productId, l.kind]).sort(), [["bissap", "unavailable"], ["karite", "price"]]);
    assert.equal(report.newTotal, null);
  });

  it("une variante disparue ou en rupture est signalée", () => {
    const variant = (stock: "en_stock" | "rupture") => [
      makeProduct({ id: "v", variants: [{ id: "v-m", attributes: { Taille: "M" }, sku: "S", stock }] }),
    ];
    const lines = [{ productId: "v", variantId: "v-m", quantity: 1 }];
    const shown = displayed("ca", lines, variant("en_stock"));
    const out = check("ca", lines, variant("rupture"), SHIPPING.ca, shown);
    assert.ok(out);
    assert.equal(out.lines[0].kind, "unavailable");
  });
});

describe("aperçu du panier côté serveur", () => {
  it("ne contient que des montants calculés, jamais ceux du navigateur", () => {
    const preview = previewCart({
      zoneId: "ca",
      lines: [{ productId: "karite", variantId: null, quantity: 2 }],
      products: new Map(WAS.map((p) => [p.id, p])),
      shipping: SHIPPING.ca,
    });
    assert.equal(preview.subtotal, 40);
    assert.equal(preview.shippingFee, 8.99);
    assert.equal(preview.total, 48.99);
    assert.equal(preview.freeShippingReached, false);
  });

  it("deux lignes du même produit sont regroupées", () => {
    const preview = previewCart({
      zoneId: "ca",
      lines: [
        { productId: "karite", variantId: null, quantity: 1 },
        { productId: "karite", variantId: null, quantity: 1 },
      ],
      products: new Map(WAS.map((p) => [p.id, p])),
      shipping: SHIPPING.ca,
    });
    assert.equal(preview.lines.length, 1);
    assert.equal(preview.products.length, 1);
  });
});
