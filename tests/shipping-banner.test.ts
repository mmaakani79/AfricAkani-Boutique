// Le bandeau de livraison : uniquement les chiffres des Réglages, jamais inventés.
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARD_NEUTRAL_TEXT,
  FREE_SHIPPING_NEUTRAL_TEXT,
  NEUTRAL_MESSAGE,
  bannerItems,
  bannerPlainText,
  freeShippingCardText,
  freeShippingLineText,
  freeShippingProductText,
} from "@/lib/shipping-banner";
import type { ShippingSettings } from "@/lib/shipping-types";
import type { ZoneId } from "@/lib/types";

const live = (t: { bj: number; ca: number; us: number }): Record<ZoneId, ShippingSettings> => ({
  bj: { zoneId: "bj", freeShippingThreshold: t.bj, shippingFee: 0, minOrderAmount: null },
  ca: { zoneId: "ca", freeShippingThreshold: t.ca, shippingFee: 0, minOrderAmount: null },
  us: { zoneId: "us", freeShippingThreshold: t.us, shippingFee: 0, minOrderAmount: null },
});

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("source des chiffres : les Réglages", () => {
  it("le seuil du Bénin vient des Réglages (20 000), pas d'un chiffre écrit dans le code (25 000)", () => {
    const items = bannerItems("bj", live({ bj: 20000, ca: 50, us: 55 }));
    assert.equal(nbsp(items[0].amount), "20 000 FCFA");
    assert.ok(!nbsp(bannerPlainText(items)).includes("25 000"));
  });

  it("si Réglages change, le bandeau change", () => {
    assert.equal(nbsp(bannerItems("bj", live({ bj: 30000, ca: 60, us: 70 }))[0].amount), "30 000 FCFA");
    assert.equal(nbsp(bannerItems("ca", live({ bj: 30000, ca: 60, us: 70 }))[0].amount), "60,00 CAD");
    assert.equal(nbsp(bannerItems("us", live({ bj: 30000, ca: 60, us: 70 }))[0].amount), "70,00 USD");
  });
});

describe("zone du client en premier", () => {
  const rules = live({ bj: 20000, ca: 50, us: 55 });

  it("Bénin d'abord, puis Canada et États-Unis", () => {
    const items = bannerItems("bj", rules);
    assert.deepEqual(items.map((i) => [i.zoneId, i.primary]), [["bj", true], ["ca", false], ["us", false]]);
  });

  it("Canada d'abord, puis Bénin et États-Unis", () => {
    assert.deepEqual(bannerItems("ca", rules).map((i) => i.zoneId), ["ca", "bj", "us"]);
  });

  it("États-Unis d'abord, puis Bénin et Canada", () => {
    assert.deepEqual(bannerItems("us", rules).map((i) => i.zoneId), ["us", "bj", "ca"]);
  });

  it("une seule zone mise en évidence", () => {
    assert.equal(bannerItems("ca", rules).filter((i) => i.primary).length, 1);
  });

  it("la phrase complète", () => {
    assert.equal(
      nbsp(bannerPlainText(bannerItems("ca", rules))),
      "Livraison offerte dès 50,00 CAD d'achat — Canada • Bénin & Afrique de l'Ouest : dès 20 000 FCFA • États-Unis : dès 55,00 USD"
    );
  });
});

describe("Réglages indisponibles : aucun chiffre inventé", () => {
  it("pas de règles chargées : aucun élément chiffré, message neutre", () => {
    assert.deepEqual(bannerItems("bj", null), []);
    assert.equal(bannerPlainText([]), NEUTRAL_MESSAGE);
    assert.ok(!/\d/.test(NEUTRAL_MESSAGE));
  });

  it("une zone sans seuil valable est omise, les autres restent exactes", () => {
    const rules = live({ bj: 20000, ca: 50, us: 55 });
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const items = bannerItems("bj", { ...rules, ca: { ...rules.ca, freeShippingThreshold: bad } });
      assert.deepEqual(items.map((i) => i.zoneId), ["bj", "us"], String(bad));
    }
    const missing = { ...rules } as Partial<Record<ZoneId, ShippingSettings>>;
    delete missing.us;
    assert.deepEqual(bannerItems("bj", missing as Record<ZoneId, ShippingSettings>).map((i) => i.zoneId), ["bj", "ca"]);
  });

  it("aucune zone valable : message neutre", () => {
    const rules = live({ bj: 0, ca: 0, us: 0 });
    assert.deepEqual(bannerItems("bj", rules), []);
  });
});

describe("carte « Livraison gratuite » de l'accueil", () => {
  const rules = live({ bj: 20000, ca: 50, us: 55 });

  it("affiche le seuil de la zone du client, lu dans les Réglages", () => {
    assert.equal(nbsp(freeShippingCardText("bj", rules)), "Dès 20 000 FCFA");
    assert.equal(nbsp(freeShippingCardText("ca", rules)), "Dès 50,00 CAD");
    assert.equal(nbsp(freeShippingCardText("us", rules)), "Dès 55,00 USD");
  });

  it("suit une modification des Réglages (aucun chiffre en dur)", () => {
    assert.equal(nbsp(freeShippingCardText("bj", live({ bj: 30000, ca: 60, us: 70 }))), "Dès 30 000 FCFA");
  });

  it("Réglages indisponibles : texte neutre, sans aucun chiffre", () => {
    assert.equal(freeShippingCardText("bj", null), CARD_NEUTRAL_TEXT);
    assert.ok(!/\d/.test(CARD_NEUTRAL_TEXT));
  });

  it("seuil de la zone invalide : texte neutre plutôt qu'un chiffre faux", () => {
    assert.equal(freeShippingCardText("ca", live({ bj: 20000, ca: 0, us: 55 })), CARD_NEUTRAL_TEXT);
  });
});

describe("pied de page, menu mobile et fiche produit : plus de seuil de repli", () => {
  const rules = live({ bj: 20000, ca: 50, us: 55 });

  it("pied de page / menu : le seuil de la zone, lu dans les Réglages", () => {
    assert.equal(nbsp(freeShippingLineText("bj", rules)), "Livraison gratuite dès 20 000 FCFA");
    assert.equal(nbsp(freeShippingLineText("ca", rules)), "Livraison gratuite dès 50,00 CAD");
    assert.equal(nbsp(freeShippingLineText("us", rules)), "Livraison gratuite dès 55,00 USD");
  });

  it("fiche produit : le seuil de la zone et le nom de la zone", () => {
    assert.equal(
      nbsp(freeShippingProductText("ca", rules, "Canada")),
      "Livraison gratuite dès 50,00 CAD d\u2019achat (Canada)"
    );
    assert.equal(
      nbsp(freeShippingProductText("bj", rules, "Bénin & Afrique de l'Ouest")),
      "Livraison gratuite dès 20 000 FCFA d\u2019achat (Bénin & Afrique de l'Ouest)"
    );
  });

  it("suit une modification des Réglages (aucun chiffre en dur)", () => {
    const changed = live({ bj: 35000, ca: 70, us: 80 });
    assert.equal(nbsp(freeShippingLineText("bj", changed)), "Livraison gratuite dès 35 000 FCFA");
    assert.equal(nbsp(freeShippingProductText("us", changed, "États-Unis")), "Livraison gratuite dès 80,00 USD d\u2019achat (États-Unis)");
  });

  it("Réglages pas encore lus ou indisponibles : texte neutre, jamais un chiffre", () => {
    assert.equal(freeShippingLineText("bj", null), FREE_SHIPPING_NEUTRAL_TEXT);
    assert.equal(freeShippingProductText("ca", null, "Canada"), `${FREE_SHIPPING_NEUTRAL_TEXT} (Canada)`);
    assert.ok(!/\d/.test(FREE_SHIPPING_NEUTRAL_TEXT));
    assert.ok(!/\d/.test(freeShippingProductText("us", null, "États-Unis")));
  });

  it("seuil de la zone invalide : neutre, pas de valeur de repli", () => {
    const broken = live({ bj: 20000, ca: 0, us: 55 });
    assert.equal(freeShippingLineText("ca", broken), FREE_SHIPPING_NEUTRAL_TEXT);
  });
});
