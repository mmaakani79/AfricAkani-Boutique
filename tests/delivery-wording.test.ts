// Les textes parlent des DESTINATIONS des livraisons, jamais d'un point de départ
// (« du Bénin au Canada… »), et ne mentionnent pas l'Europe (zone non ouverte).
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderEmailHtml } from "@/lib/email-html";

const ROOT = path.resolve(import.meta.dirname, "..");
const SENTENCE = "livrés en Afrique de l'Ouest, au Canada et aux États-Unis";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "fonts" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");

describe("les 5 emplacements disent « livrés en Afrique de l'Ouest, au Canada et aux États-Unis »", () => {
  for (const file of [
    "src/components/layout/footer.tsx",
    "src/app/notre-histoire/page.tsx",
    "src/app/layout.tsx",
    "src/lib/invoice-pdf.ts",
    "src/lib/email-html.ts",
  ]) {
    it(file, () => assert.ok(read(file).includes(SENTENCE), `phrase absente de ${file}`));
  }

  it("layout.tsx : description du site ET partage réseaux (2 emplacements)", () => {
    assert.equal(read("src/app/layout.tsx").split(SENTENCE).length - 1, 2);
  });

  it("« Notre histoire » : description SEO sans point de départ, de longueur raisonnable", () => {
    const text = fs.readFileSync(path.join(ROOT, "src/app/notre-histoire/page.tsx"), "utf8");
    const match = text.match(/description:\s*"([^"]+)"/);
    assert.ok(match);
    assert.equal(
      match[1],
      "Africa + Akani : l'histoire d'une boutique née d'une conviction simple, pour l'Afrique de l'Ouest et la diaspora au Canada et aux États-Unis."
    );
    assert.ok(match[1].length <= 160, `${match[1].length} caractères`);
  });
});

describe("aucune formule d'origine ni mention de l'Europe dans le site", () => {
  // Formule connue, en attente de décision (liste d'étape : « Pont » de Notre histoire).
  const KNOWN = [{ file: "src/app/notre-histoire/page.tsx", fragment: "Du Bénin au Canada, une boutique pour ceux d'ici" }];
  const BANNED = [/du Bénin au/i, /depuis le Bénin/i, /Bénin au Canada/i, /\bEurope\b/i, /européen/i, /livrés? gratuitement/i, /Livrés chez vous/i];

  it("balayage de tout src/", () => {
    const found: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        const m = content.match(new RegExp(pattern.source, "gi"));
        for (const hit of m ?? []) {
          const known = KNOWN.some((k) => k.file === rel && content.includes(k.fragment) && /Bénin au/i.test(hit));
          if (!known) found.push(`${rel} : « ${hit} »`);
        }
      }
    }
    assert.deepEqual(found, []);
  });
});

describe("e-mail HTML", () => {
  const html = renderEmailHtml("Sujet", ["Bonjour,", "", "Merci."]);

  it("pied de page avec les destinations, sans point de départ", () => {
    assert.ok(html.replace(/\s+/g, " ").includes(SENTENCE));
    assert.ok(!/du Bénin/i.test(html));
  });

  it("le texte brut (lignes du message) ne reprend aucune formule de ce type", () => {
    const emailSource = fs.readFileSync(path.join(ROOT, "src/lib/email.ts"), "utf8");
    assert.ok(!/livrés? (du|en|au)/i.test(emailSource));
  });
});

describe("facture PDF", () => {
  it("se génère toujours (une page, document valide) avec la nouvelle phrase d'en-tête", async () => {
    const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
    const order = {
      id: "AK-TEST", createdAt: new Date().toISOString(), zoneId: "bj", subtotal: 6000, shippingFee: 0,
      customerName: "Awa Koné", customerPhone: "+22997000000", customerEmail: "awa@example.com",
      customerAddress: "Rue 12", customerCity: "Cotonou", customerApartment: null, customerProvince: null,
      customerPostalCode: null, customerCountry: "Bénin", freeShippingReached: false, status: "nouvelle",
      paymentStatus: "paye", paymentMethod: "stripe", isTest: false, reminder24hSentAt: null, reminder48hSentAt: null,
      emailError: null, mobileMoneyOperator: null, mobileMoneyPhone: null, mobileMoneyTransactionId: null,
      stripeCheckoutSessionId: null, stripePaymentIntentId: null, paypalOrderId: null, paypalCaptureId: null, reminders: [],
      items: [{ productId: "p02", productName: "Beurre de karité", productSku: null, quantity: 2, unitPrice: 3000, lineTotal: 6000 }],
    };
    const pdf = await generateInvoicePdf(order as never);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 1000);
    assert.equal((pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length, 1);
  });
});
