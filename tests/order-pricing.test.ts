// Server-side pricing: the browser's amounts are never trusted.
// Run with `npm test` (Node's built-in test runner, no extra dependency).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_QUANTITY_PER_LINE, parseOrderDraft } from "@/lib/order-draft";
import {
  priceOrder,
  stripeAmountMatchesQuote,
  stripeChargeMinor,
  stripeLineItems,
  summarizeQuote,
  toMinorUnits,
  type OrderQuote,
  type RequestedLine,
} from "@/lib/order-pricing";
import { priceForQuantity } from "@/lib/price-tiers";
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
    prices: { bj: 1000, ca: 5, us: 5 },
    stock: "en_stock",
    ...over,
  };
}

const SHIPPING: Record<ZoneId, ShippingSettings> = {
  bj: { zoneId: "bj", freeShippingThreshold: 25000, shippingFee: 1500, minOrderAmount: null },
  ca: { zoneId: "ca", freeShippingThreshold: 50, shippingFee: 8.99, minOrderAmount: null },
  us: { zoneId: "us", freeShippingThreshold: 55, shippingFee: 9.5, minOrderAmount: null },
};

const CATALOG = [
  makeProduct({
    id: "piment",
    name: "Piment moulu",
    prices: { bj: 2500, ca: 4.99, us: 5.49 },
    priceTiers: {
      bj: [{ minQty: 10, price: 2200 }],
      ca: [{ minQty: 10, price: 4.5 }],
      us: [{ minQty: 10, price: 5 }],
    },
  }),
  makeProduct({ id: "gombo", name: "Gombo séché", prices: { bj: 1000, ca: 12.25, us: 13 } }),
  makeProduct({ id: "bj-seulement", name: "Attiéké", prices: { bj: 800, ca: null, us: null } }),
  makeProduct({ id: "epuise", name: "Fonio", stock: "rupture" }),
  makeProduct({
    id: "boubou",
    name: "Boubou",
    prices: { bj: 15000, ca: 40, us: 42 },
    variants: [
      { id: "boubou-m", attributes: { Taille: "M", Couleur: "Rouge" }, sku: "SKU-M", stock: "en_stock" },
      { id: "boubou-xl", attributes: { Taille: "XL", Couleur: "Rouge" }, sku: "SKU-XL", stock: "rupture" },
    ],
  }),
];
const PRODUCTS = new Map(CATALOG.map((p) => [p.id, p]));

function quote(zoneId: ZoneId, lines: RequestedLine[], shipping = SHIPPING[zoneId]): OrderQuote {
  const result = priceOrder({ zoneId, lines, products: PRODUCTS, shipping });
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.quote;
}

function refusal(zoneId: ZoneId, lines: RequestedLine[], shipping = SHIPPING[zoneId]): string {
  const result = priceOrder({ zoneId, lines, products: PRODUCTS, shipping });
  assert.ok(!result.ok, "la commande aurait dû être refusée");
  return result.error;
}

const line = (productId: string, quantity: number, variantId: string | null = null): RequestedLine => ({
  productId,
  variantId,
  quantity,
});

const CUSTOMER = { name: "A B", email: "a@b.c", phone: "1", address: "1 rue X", city: "Y" };

// The delivery country must belong to the chosen zone (see zone-countries.test.ts):
// by default the draft's address is in the zone it asks for.
const COUNTRY_OF_ZONE: Record<string, string> = { bj: "Bénin", ca: "Canada", us: "États-Unis" };

function rawDraft(over: Record<string, unknown> = {}) {
  const zoneId = (over.zoneId as string | undefined) ?? "ca";
  return {
    id: "AK-TEST1",
    zoneId: "ca",
    currency: "CAD",
    items: [{ productId: "piment", variantId: null, quantity: 2 }],
    customer: { ...CUSTOMER, country: COUNTRY_OF_ZONE[zoneId] },
    ...over,
  };
}

describe("panier normal", () => {
  it("Bénin : sous-total, livraison et total en FCFA", () => {
    const q = quote("bj", [line("piment", 2), line("gombo", 1)]);
    assert.equal(q.currency, "FCFA");
    assert.equal(q.subtotal, 6000);
    assert.equal(q.shippingFee, 1500);
    assert.equal(q.total, 7500);
    assert.equal(q.freeShippingReached, false);
    assert.deepEqual(
      q.lines.map((l) => [l.productId, l.unitPrice, l.lineTotal]),
      [["piment", 2500, 5000], ["gombo", 1000, 1000]]
    );
  });

  it("Canada : sous-total, livraison et total en CAD", () => {
    const q = quote("ca", [line("piment", 3), line("gombo", 1)]);
    assert.equal(q.currency, "CAD");
    assert.equal(q.subtotal, 27.22); // 3 × 4,99 + 12,25
    assert.equal(q.shippingFee, 8.99);
    assert.equal(q.total, 36.21);
  });

  it("États-Unis : sous-total, livraison et total en USD", () => {
    const q = quote("us", [line("piment", 2), line("gombo", 2)]);
    assert.equal(q.currency, "USD");
    assert.equal(q.subtotal, 36.98); // 2 × 5,49 + 2 × 13
    assert.equal(q.shippingFee, 9.5);
    assert.equal(q.total, 46.48);
  });

  it("donne les mêmes totaux que le calcul historique du navigateur (prix × quantité, arrondi à l'affichage)", () => {
    // Deterministic pseudo-random carts; the old browser formula was
    // sum(priceForQuantity × quantity) — compared at the cent.
    let seed = 12345;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const ids = ["piment", "gombo"];
    for (const zoneId of ["bj", "ca", "us"] as ZoneId[]) {
      for (let i = 0; i < 300; i++) {
        const lines = ids.map((id) => line(id, 1 + rand(40)));
        const oldSubtotal = lines.reduce(
          (sum, l) => sum + priceForQuantity(PRODUCTS.get(l.productId)!, zoneId, l.quantity)! * l.quantity,
          0
        );
        const q = quote(zoneId, lines);
        const cents = (n: number) => (zoneId === "bj" ? Math.round(n) : Math.round(n * 100));
        assert.equal(cents(q.subtotal), cents(oldSubtotal), `${zoneId} ${JSON.stringify(lines)}`);
      }
    }
  });

  it("applique le palier de prix à partir de la quantité, et regroupe les lignes identiques", () => {
    assert.equal(quote("ca", [line("piment", 9)]).lines[0].unitPrice, 4.99);
    assert.equal(quote("ca", [line("piment", 10)]).lines[0].unitPrice, 4.5);
    // 5 + 5 sur deux lignes = 10 unités : un seul palier, une seule ligne.
    const split = quote("ca", [line("piment", 5), line("piment", 5)]);
    assert.equal(split.lines.length, 1);
    assert.equal(split.lines[0].quantity, 10);
    assert.equal(split.lines[0].unitPrice, 4.5);
  });

  it("variante : nom, référence interne et stock viennent de la base", () => {
    const q = quote("ca", [line("boubou", 1, "boubou-m")]);
    assert.equal(q.lines[0].name, "Boubou (Taille: M, Couleur: Rouge)");
    assert.equal(q.lines[0].sku, "SKU-M");
    assert.equal(q.lines[0].unitPrice, 40);
  });
});

describe("montants falsifiés : ignorés", () => {
  it("prix, totaux, livraison et noms envoyés par le navigateur ne sont pas lus", () => {
    const honest = parseOrderDraft(rawDraft());
    const forged = parseOrderDraft(
      rawDraft({
        subtotal: 0.01,
        total: 0.01,
        shippingFee: 0,
        freeShippingReached: true,
        items: [
          {
            productId: "piment",
            variantId: null,
            quantity: 2,
            unitPrice: 0.01,
            lineTotal: 0.02,
            name: "Cadeau gratuit",
            sku: "AK-HACK",
          },
        ],
      })
    );
    assert.ok(honest.ok && forged.ok);
    assert.deepEqual(forged.draft.lines, honest.draft.lines);
    const kept = JSON.stringify(forged.draft);
    for (const leaked of ["0.01", "Cadeau", "AK-HACK", "unitPrice", "lineTotal", "subtotal", "shippingFee"]) {
      assert.ok(!kept.includes(leaked), `« ${leaked} » ne devrait pas survivre à la validation`);
    }
    const q = quote("ca", forged.draft.lines);
    assert.equal(q.subtotal, 9.98);
    assert.equal(q.total, 18.97);
    assert.equal(q.lines[0].name, "Piment moulu");
  });

  it("ce qui part vers Stripe vient uniquement du calcul serveur", () => {
    const q = quote("ca", [line("piment", 2)]);
    const items = stripeLineItems(q);
    assert.deepEqual(items.map((i) => [i.price_data.product_data.name, i.price_data.unit_amount, i.quantity]), [
      ["Piment moulu", 499, 2],
      ["Livraison", 899, 1],
    ]);
    assert.equal(stripeChargeMinor(items), toMinorUnits(q.total));
    assert.ok(items.every((i) => i.price_data.currency === "cad"));
  });

  it("le résumé renvoyé au navigateur ne contient aucune référence interne", () => {
    const q = quote("ca", [line("boubou", 1, "boubou-m")]);
    assert.ok(!JSON.stringify(summarizeQuote(q)).includes("SKU-M"));
  });
});

describe("quantités invalides", () => {
  for (const bad of [0, -1, 1.5, 0.1, NaN, Infinity, MAX_QUANTITY_PER_LINE + 1, "3", null, undefined, [], {}]) {
    it(`refuse ${JSON.stringify(bad) ?? String(bad)}`, () => {
      const r = parseOrderDraft(rawDraft({ items: [{ productId: "piment", quantity: bad }] }));
      assert.ok(!r.ok);
      assert.match(r.error, /Quantité invalide/);
    });
  }

  it("accepte 1 et la quantité maximale", () => {
    assert.ok(parseOrderDraft(rawDraft({ items: [{ productId: "piment", quantity: 1 }] })).ok);
    assert.ok(parseOrderDraft(rawDraft({ items: [{ productId: "piment", quantity: MAX_QUANTITY_PER_LINE }] })).ok);
  });

  it("refuse une quantité cumulée absurde obtenue en multipliant les lignes", () => {
    // Deux lignes valides, mais leur somme dépasse le plafond d'une ligne.
    const r = parseOrderDraft(
      rawDraft({
        items: [
          { productId: "piment", quantity: 600 },
          { productId: "piment", quantity: 600 },
        ],
      })
    );
    assert.ok(r.ok);
    assert.match(refusal("ca", r.draft.lines), /Quantité invalide/);
  });
});

describe("produits refusés", () => {
  it("produit introuvable", () => {
    assert.match(refusal("ca", [line("fantome", 1)]), /n'existe plus/);
  });

  it("produit indisponible (rupture de stock)", () => {
    assert.match(refusal("ca", [line("epuise", 1)]), /rupture de stock/);
  });

  it("variante en rupture, introuvable, absente ou sur un produit sans variantes", () => {
    assert.match(refusal("ca", [line("boubou", 1, "boubou-xl")]), /rupture de stock/);
    assert.match(refusal("ca", [line("boubou", 1, "inconnue")]), /n'existe plus/);
    assert.match(refusal("ca", [line("boubou", 1)]), /Choisissez une variante/);
    assert.match(refusal("ca", [line("piment", 1, "boubou-m")]), /n'existe pas/);
  });

  it("produit non vendu dans la zone", () => {
    assert.match(refusal("ca", [line("bj-seulement", 1)]), /pas vendu dans cette zone/);
    assert.match(refusal("us", [line("bj-seulement", 1)]), /pas vendu dans cette zone/);
    assert.equal(quote("bj", [line("bj-seulement", 1)]).subtotal, 800);
  });

  it("commande refusée en entier si une seule ligne est invalide", () => {
    assert.match(refusal("ca", [line("piment", 1), line("fantome", 1)]), /n'existe plus/);
  });
});

describe("zone et devise", () => {
  for (const zone of ["fr", "", "constructor", "__proto__", "toString", null, undefined, 3, {}]) {
    it(`zone non servie : ${JSON.stringify(zone) ?? String(zone)}`, () => {
      const r = parseOrderDraft(rawDraft({ zoneId: zone, currency: undefined }));
      assert.ok(!r.ok);
      assert.match(r.error, /zone de livraison n'est pas desservie/);
    });
  }

  it("devise incohérente avec la zone", () => {
    for (const [zoneId, currency] of [["ca", "USD"], ["us", "CAD"], ["bj", "CAD"], ["ca", "EUR"], ["ca", 5]] as const) {
      const r = parseOrderDraft(rawDraft({ zoneId, currency }));
      assert.ok(!r.ok, `${zoneId}/${currency}`);
      assert.match(r.error, /Devise incohérente/);
    }
    assert.ok(parseOrderDraft(rawDraft({ zoneId: "us", currency: "USD" })).ok);
    assert.ok(parseOrderDraft(rawDraft({ zoneId: "bj", currency: "FCFA" })).ok);
  });
});

describe("forme de la commande", () => {
  it("panier vide, trop de lignes, ligne ou client invalides", () => {
    assert.match((parseOrderDraft(rawDraft({ items: [] })) as { error: string }).error, /panier est vide/);
    assert.match((parseOrderDraft(rawDraft({ items: undefined })) as { error: string }).error, /panier est vide/);
    const many = Array.from({ length: 51 }, (_, i) => ({ productId: `p${i}`, quantity: 1 }));
    assert.match((parseOrderDraft(rawDraft({ items: many })) as { error: string }).error, /trop de lignes/);
    assert.ok(!parseOrderDraft(rawDraft({ items: [{ productId: 7, quantity: 1 }] })).ok);
    assert.ok(!parseOrderDraft(rawDraft({ items: [{ productId: "piment", variantId: 5, quantity: 1 }] })).ok);
    assert.ok(!parseOrderDraft(rawDraft({ customer: { ...CUSTOMER, name: 12 } })).ok);
    assert.ok(!parseOrderDraft(rawDraft({ customer: null })).ok);
    assert.ok(!parseOrderDraft(rawDraft({ id: "../../x" })).ok);
    assert.ok(!parseOrderDraft(null).ok);
    assert.ok(!parseOrderDraft("commande").ok);
  });
});

describe("livraison offerte (seuils 50 CAD / 55 USD / 25 000 FCFA)", () => {
  const only = (price: number) =>
    new Map([["x", makeProduct({ id: "x", prices: { bj: price, ca: price, us: price } })]]);

  function atSubtotal(zoneId: ZoneId, price: number) {
    const r = priceOrder({ zoneId, lines: [line("x", 1)], products: only(price), shipping: SHIPPING[zoneId] });
    assert.ok(r.ok);
    return r.quote;
  }

  it("Canada : 49,99 payant, 50,00 gratuit", () => {
    assert.equal(atSubtotal("ca", 49.99).shippingFee, 8.99);
    assert.equal(atSubtotal("ca", 49.99).freeShippingReached, false);
    assert.equal(atSubtotal("ca", 50).shippingFee, 0);
    assert.equal(atSubtotal("ca", 50).freeShippingReached, true);
    assert.equal(atSubtotal("ca", 50).total, 50);
  });

  it("États-Unis : 54,99 payant, 55,00 gratuit", () => {
    assert.equal(atSubtotal("us", 54.99).shippingFee, 9.5);
    assert.equal(atSubtotal("us", 55).shippingFee, 0);
  });

  it("Bénin : 24 999 payant, 25 000 gratuit", () => {
    assert.equal(atSubtotal("bj", 24999).shippingFee, 1500);
    assert.equal(atSubtotal("bj", 25000).shippingFee, 0);
    assert.equal(atSubtotal("bj", 25000).total, 25000);
  });

  it("le seuil se joue sur le prix recalculé : un panier falsifié à 50 $ ne l'atteint pas", () => {
    // 2 × 4,99 = 9,98 : la livraison reste due, quel que soit le « sous-total » annoncé.
    const q = quote("ca", [line("piment", 2)]);
    assert.equal(q.freeShippingReached, false);
    assert.equal(q.shippingFee, 8.99);
  });

  it("montant minimum de commande", () => {
    const withMin = { ...SHIPPING.ca, minOrderAmount: 20 };
    assert.match(refusal("ca", [line("piment", 2)], withMin), /Montant minimum de commande/);
    assert.ok(priceOrder({ zoneId: "ca", lines: [line("gombo", 2)], products: PRODUCTS, shipping: withMin }).ok);
  });
});

describe("une commande par zone, jusqu'aux montants envoyés aux paiements", () => {
  const cases: [ZoneId, RequestedLine[]][] = [
    ["bj", [line("piment", 12), line("gombo", 3)]],
    ["ca", [line("piment", 12), line("gombo", 3), line("boubou", 1, "boubou-m")]],
    ["us", [line("piment", 1), line("gombo", 7)]],
  ];
  for (const [zoneId, lines] of cases) {
    it(zoneId, () => {
      const q = quote(zoneId, lines);
      assert.equal(q.zoneId, zoneId);
      assert.equal(q.total, Math.round((q.subtotal + q.shippingFee) * 100) / 100);
      assert.equal(q.lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2), q.subtotal.toFixed(2));
      if (zoneId !== "bj") {
        // Stripe et PayPal facturent exactement le total enregistré sur la commande.
        assert.ok(stripeAmountMatchesQuote(q));
        assert.equal(stripeChargeMinor(stripeLineItems(q)), toMinorUnits(q.total));
        assert.equal(q.total.toFixed(2), (toMinorUnits(q.total) / 100).toFixed(2));
      }
    });
  }
});
