// Cohérence adresse / zone : le pays de livraison doit appartenir à la zone choisie,
// vérifié côté serveur pour TOUS les modes de paiement. Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseOrderDraft } from "@/lib/order-draft";
import {
  ZONE_COUNTRY_CODES,
  checkAddressCountry,
  countriesForZone,
  countryCodeFromText,
  zoneForCountryCode,
} from "@/lib/zone-countries";
import type { ZoneId } from "@/lib/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const ZONES: ZoneId[] = ["bj", "ca", "us"];

describe("table zone ↔ pays (à valider)", () => {
  it("contenu exact de la table", () => {
    assert.deepEqual(ZONE_COUNTRY_CODES, {
      bj: ["BJ"],
      ca: ["CA"],
      us: ["US"],
    });
    assert.deepEqual(
      countriesForZone("bj").map((c) => c.name),
      ["Bénin"]
    );
    assert.deepEqual(countriesForZone("ca").map((c) => c.name), ["Canada"]);
    assert.deepEqual(countriesForZone("us").map((c) => c.name), ["États-Unis"]);
  });

  it("un pays n'appartient qu'à une seule zone", () => {
    const seen = new Map<string, ZoneId>();
    for (const zone of ZONES) {
      for (const code of ZONE_COUNTRY_CODES[zone]) {
        assert.ok(!seen.has(code), `${code} dans deux zones`);
        seen.set(code, zone);
        assert.equal(zoneForCountryCode(code), zone);
      }
    }
    assert.equal(zoneForCountryCode("FR"), null);
  });
});

describe("reconnaissance des noms de pays (accents, casse, abréviations)", () => {
  const cases: [string, string | null][] = [
    ["Bénin", "BJ"], ["BENIN", "BJ"], ["  benin  ", "BJ"], ["Republic of Benin", "BJ"],
    ["Togo", null], ["Burkina Faso", null], ["Côte d'Ivoire", null], ["Sénégal", null], ["Mali", null], ["Guinée-Bissau", null],
    ["Canada", "CA"], ["canada", "CA"], ["CA", "CA"],
    ["États-Unis", "US"], ["Etats-Unis", "US"], ["états unis", "US"], ["USA", "US"], ["U.S.A.", "US"],
    ["United States", "US"], ["United States of America", "US"], ["États-Unis d'Amérique", "US"],
    ["Niger", null], ["Nigeria", null], ["Ghana", null], ["France", null], ["Guinée", null], ["", null], ["   ", null],
  ];
  for (const [input, expected] of cases) {
    it(`« ${input} » → ${expected ?? "inconnu"}`, () => assert.equal(countryCodeFromText(input), expected));
  }
});

describe("checkAddressCountry : accepté / refusé avec un message clair", () => {
  it("accepte un pays de la zone et le renvoie sous son nom officiel", () => {
    assert.deepEqual(checkAddressCountry("ca", "canada"), { ok: true, country: "Canada" });
    assert.deepEqual(checkAddressCountry("us", "Etats-Unis"), { ok: true, country: "États-Unis" });
    assert.deepEqual(checkAddressCountry("bj", "benin"), { ok: true, country: "Bénin" });
    assert.deepEqual(checkAddressCountry("bj", "Republic of Benin"), { ok: true, country: "Bénin" });
  });

  it("refuse un pays d'une autre zone en citant les deux zones", () => {
    const r = checkAddressCountry("ca", "États-Unis");
    assert.ok(!r.ok);
    assert.match(r.error, /L'adresse indiquée est en États-Unis/);
    assert.match(r.error, /zone de livraison choisie est « Canada »/);
    assert.match(r.error, /choisissez la zone « États-Unis »/);

    const r2 = checkAddressCountry("bj", "Canada");
    assert.ok(!r2.ok);
    assert.match(r2.error, /pays desservis : Bénin\)/);
    assert.doesNotMatch(r2.error, /Togo|Sénégal|Afrique de l'Ouest, /);
    assert.match(r2.error, /choisissez la zone « Canada »/);
  });

  it("refuse proprement un pays sans zone et explique pourquoi", () => {
    const r = checkAddressCountry("ca", "France");
    assert.ok(!r.ok);
    assert.match(r.error, /Nous ne livrons pas encore en « France »/);
    assert.match(r.error, /Pays desservis/);
    assert.match(r.error, /Canada/);
    assert.ok(!checkAddressCountry("bj", "Nigeria").ok);
  });

  it("refuse un pays absent", () => {
    for (const empty of [undefined, null, "", "  "]) {
      const r = checkAddressCountry("bj", empty);
      assert.ok(!r.ok);
      assert.equal(r.error, "Merci d'indiquer le pays de livraison.");
    }
  });
});

// ---- Le contrôle est appliqué à la commande, quel que soit le mode de paiement ----

function draft(zoneId: ZoneId, country: unknown, extra: Record<string, unknown> = {}) {
  const currency = { bj: "FCFA", ca: "CAD", us: "USD" }[zoneId];
  return {
    id: "AK-ZONE1",
    zoneId,
    currency,
    items: [{ productId: "piment", variantId: null, quantity: 1 }],
    customer: { name: "A B", email: "a@b.c", phone: "1", address: "1 rue X", city: "Y", country },
    ...extra,
  };
}

const PAYMENT_MODES: [string, Record<string, unknown>][] = [
  ["WhatsApp (sans mode explicite)", {}],
  ["Mobile Money", { paymentMethod: "mobile_money", mobileMoneyOperator: "mtn", mobileMoneyPhone: "97000000", mobileMoneyTransactionId: "TX1" }],
  ["Stripe (carte)", { paymentMethod: "stripe" }],
  ["PayPal", { paymentMethod: "paypal" }],
];

describe("commande : adresse cohérente acceptée, incohérente refusée (tous les modes de paiement)", () => {
  const coherent: [ZoneId, string][] = [["bj", "Bénin"], ["ca", "Canada"], ["us", "États-Unis"]];
  for (const [mode, extra] of PAYMENT_MODES) {
    for (const [zone, country] of coherent) {
      it(`${mode} · zone ${zone} · ${country} : acceptée`, () => {
        const r = parseOrderDraft(draft(zone, country, extra));
        assert.ok(r.ok, r.ok ? "" : r.error);
        assert.equal(r.draft.customer.country, country);
      });
    }
    for (const zone of ZONES) {
      for (const other of ZONES.filter((z) => z !== zone)) {
        const country = countriesForZone(other)[0].name;
        it(`${mode} · zone ${zone} avec une adresse en ${country} : refusée`, () => {
          const r = parseOrderDraft(draft(zone, country, extra));
          assert.ok(!r.ok);
          assert.match(r.error, /zone de livraison choisie/);
        });
      }
    }
    it(`${mode} : pays sans zone, pays vide ou absent : refusés`, () => {
      assert.ok(!parseOrderDraft(draft("ca", "France", extra)).ok);
      assert.ok(!parseOrderDraft(draft("bj", "Nigeria", extra)).ok);
      // les anciens voisins de la zone franc CFA ne sont plus desservis
      for (const voisin of ["Togo", "Burkina Faso", "Côte d'Ivoire", "Mali", "Niger", "Sénégal", "Guinée-Bissau"]) {
        const r = parseOrderDraft(draft("bj", voisin, extra));
        assert.ok(!r.ok, voisin);
        assert.match(r.error, /Nous ne livrons pas encore/);
      }
      assert.ok(!parseOrderDraft(draft("ca", "", extra)).ok);
      assert.ok(!parseOrderDraft(draft("us", null, extra)).ok);
      assert.ok(!parseOrderDraft(draft("us", undefined, extra)).ok);
    });
  }

  it("le pays est enregistré sous son nom officiel même s'il est saisi autrement", () => {
    const r = parseOrderDraft(draft("us", "usa"));
    assert.ok(r.ok);
    assert.equal(r.draft.customer.country, "États-Unis");
    const r2 = parseOrderDraft(draft("bj", "BENIN"));
    assert.ok(r2.ok);
    assert.equal(r2.draft.customer.country, "Bénin");
  });

  it("un pays qui n'est pas du texte est refusé", () => {
    assert.ok(!parseOrderDraft(draft("ca", 42)).ok);
  });
});

describe("tous les chemins de commande passent par cette vérification, avant tout paiement", () => {
  const actions = read("src/app/commande/actions.ts");
  const body = (name: string) => {
    const start = actions.indexOf(`export async function ${name}`);
    const next = actions.indexOf("export async function", start + 10);
    return actions.slice(start, next === -1 ? undefined : next);
  };

  it("WhatsApp / Mobile Money : parseOrderDraft avant la création de la commande", () => {
    const b = body("submitOrderAction");
    assert.ok(b.indexOf("parseOrderDraft(") !== -1);
    assert.ok(b.indexOf("parseOrderDraft(") < b.indexOf("createOrder("));
  });

  it("Stripe : parseOrderDraft avant le client Stripe, la commande et la session", () => {
    const b = body("createStripeCheckoutAction");
    const parse = b.indexOf("parseOrderDraft(");
    assert.ok(parse !== -1);
    for (const later of ["getStripeClient(", "createOrder(", "checkout.sessions.create("]) {
      assert.ok(parse < b.indexOf(later), later);
    }
  });

  it("PayPal : parseOrderDraft avant la commande et l'appel PayPal", () => {
    const b = body("createPaypalOrderAction");
    const parse = b.indexOf("parseOrderDraft(");
    assert.ok(parse !== -1);
    for (const later of ["createOrder(", "createPaypalOrder("]) assert.ok(parse < b.indexOf(later), later);
  });

  it("aucune autre action de commande n'enregistre une commande sans passer par parseOrderDraft", () => {
    const creators = [...actions.matchAll(/export async function (\w+)/g)]
      .map((m) => m[1])
      .filter((name) => /createOrder\(/.test(body(name)));
    assert.deepEqual(creators.sort(), ["createPaypalOrderAction", "createStripeCheckoutAction", "submitOrderAction"]);
    for (const name of creators) assert.match(body(name), /parseOrderDraft\(/);
  });

  it("le formulaire n'a plus de champ pays libre : une liste limitée aux pays de la zone", () => {
    const page = read("src/app/commande/page.tsx");
    assert.ok(!/<Field label="Pays"/.test(page));
    assert.match(page, /countriesForZone\(zoneId\)/);
    assert.match(page, /<SelectField\s+label="Pays"/);
    assert.match(page, /country: deliveryCountry,/);
  });
});
