// PDF : aucun caractère parasite (« Ð », caractères de contrôle) dans le texte, retours à la ligne Windows / Unix,
// signature entière. Couvre le contrat signé, la facture de commande et la facture d'un dossier de service.
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { pdfOneLine, pdfSafeText } from "@/lib/pdf-text";
import { generateContractPdf } from "@/lib/contract-pdf";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { generateServiceInvoicePdf } from "@/lib/service-invoice-pdf";
import { computeAccountState } from "@/lib/service-account-math";
import type { SignedContract } from "@/lib/contracts-db";
import type { OrderDetail } from "@/lib/orders-db";
import type { ServiceAccountFull, ServicePayment } from "@/lib/service-accounts-db";
import { forbiddenIn, framedSignaturePng, greenBox, pdfLines, pdfPages, pdfText } from "./pdf-helpers";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Écrit en \u pour ne jamais coller de vrais caractères spéciaux dans ce fichier.
const NBSP = " ";
const NARROW = " ";
const HOSTILE = `A\r\nB\rC D E\tF\u0000G\u0007H​I­J${NARROW}K${NBSP}L M﻿N \u{1F600} Oā P−Q`;

describe("pdfSafeText : ce qui est écrit dans un PDF", () => {
  it("retours à la ligne Windows, anciens Mac et Unicode : un vrai « \\n », lignes vides conservées", () => {
    assert.equal(pdfSafeText("a\r\nb\r\n\r\nc"), "a\nb\n\nc");
    assert.equal(pdfSafeText("a\rb"), "a\nb");
    assert.equal(pdfSafeText("a b c\u0085d"), "a\nb\nc\nd");
    assert.equal(pdfSafeText("a\nb\n\nc"), "a\nb\n\nc");
    assert.equal(pdfSafeText("1. Objet\r\n\r\n2. Prix\r\n"), "1. Objet\n\n2. Prix\n");
  });
  it("un texte déjà propre n'est pas modifié : accents, guillemets français, apostrophes, tirets, œ, €, espace insécable", () => {
    const clean = `« Contrat » — l’objet “très” utile… œuvre ŒUF é è ê à ç ñ ü € 50${NBSP}000 FCFA – ok • ™`;
    assert.equal(pdfSafeText(clean), clean);
  });
  it("espace insécable fine (U+202F) : devient une espace insécable (le « / » disparaît), les autres espaces larges une espace", () => {
    assert.equal(pdfSafeText(`1${NARROW}000`), `1${NBSP}000`);
    assert.equal(pdfSafeText("a b c"), "a b c");
  });
  it("caractères de contrôle et invisibles supprimés ; tabulation = 4 espaces", () => {
    assert.equal(pdfSafeText("a\u0000b\u0007c\u001fd\u007fe\u0090f"), "abcdef");
    assert.equal(pdfSafeText("a​b‏c﻿d­e"), "abcde");
    assert.equal(pdfSafeText("a\tb"), "a    b");
  });
  it("signe moins et flèches ramenés à des caractères simples ; lettres hors alphabet : la lettre de base ; le reste : « ? »", () => {
    assert.equal(pdfSafeText("−5"), "-5");
    assert.equal(pdfSafeText("a→b"), "a->b");
    assert.equal(pdfSafeText("āő"), "ao");
    assert.equal(pdfSafeText("a\u{1F600}b"), "a?b");
  });
  it("jamais de caractère de contrôle en sortie, quoi qu'on entre", () => {
    assert.equal(forbiddenIn(pdfSafeText(HOSTILE).replace(/\n/g, " ")), null);
    assert.equal(pdfSafeText(undefined as unknown as string), "");
  });
  it("pdfOneLine : une seule ligne", () => {
    assert.equal(pdfOneLine("a\r\n\r\nb\nc  "), "a b c");
  });
});

function contract(over: Partial<SignedContract> = {}): SignedContract {
  return {
    id: "CT-PDFTEST-0001", createdAt: "2026-10-13T13:32:00.000Z", clientName: "Awa Koné", clientEmail: "awa@example.com",
    clientPhone: "+229 97 00 00 00", companyName: "Koné & Fils", services: ["Site web", "Boutique en ligne"],
    projectDescription: "Un site.\r\n\r\nDeuxième paragraphe, « guillemets » é è à.", budget: "500 000 FCFA", timeline: "6 semaines",
    notes: "Note 1\r\nNote 2", contractTextSnapshot: "AKAGESTSOFT\r\n\r\n1. Objet\r\nLe prestataire fournit « le service » : é è ê à ç œ ñ.\r\n\r\n2. Prix" + NBSP + ":" + NARROW + "50" + NBSP + "000 FCFA\r\nLigne finale",
    signatureDataUrl: framedSignaturePng(), emails: { admin: { sentAt: null, error: null, claimedAt: null }, client: { sentAt: null, error: null, claimedAt: null } },
    ...over,
  };
}

describe("PDF du contrat signé", () => {
  it("texte à retours Windows (\\r\\n) : aucun « Ð », aucun caractère de contrôle, lignes vides entre les articles conservées", async () => {
    const text = pdfText(await generateContractPdf(contract()));
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
    const lines = text.slice(text.indexOf("TEXTE DU CONTRAT")).split("\n").map((l) => l.replace(/\s+$/, ""));
    const i = lines.indexOf("AKAGESTSOFT");
    assert.deepEqual(lines.slice(i, i + 8), ["AKAGESTSOFT", "", "1. Objet", "Le prestataire fournit « le service » : é è ê à ç œ ñ.", "", "2. Prix : 50 000 FCFA", "Ligne finale", ""]);
  });
  it("le même texte avec des retours Unix (\\n) ou Windows (\\r\\n) donne exactement le même PDF visible", async () => {
    const unix = contract({ contractTextSnapshot: contract().contractTextSnapshot.replace(/\r\n/g, "\n"), projectDescription: "Un site.\n\nDeuxième paragraphe, « guillemets » é è à.", notes: "Note 1\nNote 2" });
    const [a, b] = [pdfText(await generateContractPdf(contract())), pdfText(await generateContractPdf(unix))];
    if (!a || !b) return;
    assert.equal(a, b);
  });
  it("description et précisions saisies par le client (retours Windows) : sans caractère parasite", async () => {
    const text = pdfText(await generateContractPdf(contract()));
    if (!text) return;
    assert.match(text, /Un site\.\s*\n\s*\n\s*Deuxième paragraphe, « guillemets » é è à\./);
    assert.match(text, /Note 1\s*\n\s*Note 2/);
  });
  it("tous les champs avec des caractères hostiles : le texte extrait n'a ni « Ð » ni caractère de contrôle", async () => {
    const hostile = contract({
      id: "CT-HOSTILE-0001", clientName: HOSTILE, clientEmail: HOSTILE, clientPhone: HOSTILE, companyName: HOSTILE, services: [HOSTILE],
      projectDescription: HOSTILE, budget: HOSTILE, timeline: HOSTILE, notes: HOSTILE, contractTextSnapshot: HOSTILE + "\r\n" + HOSTILE,
    });
    const text = pdfText(await generateContractPdf(hostile));
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
    assert.ok(text.includes("1" + " " + "000") === false);
  });
  it("le contrat stocké n'est pas modifié par la génération du PDF (texte, signature, date, identifiant)", async () => {
    const c = contract();
    const before = JSON.stringify(c);
    await generateContractPdf(c);
    assert.equal(JSON.stringify(c), before);
    assert.ok(c.contractTextSnapshot.includes("\r\n"), "les retours Windows sont toujours dans la donnée");
  });
  it("sans pdftotext : le PDF reste sur 2 pages (couverture + texte)", async () => {
    assert.equal(pdfPages(await generateContractPdf(contract())), 2);
  });

  it("signature entière, jamais coupée : le texte occupe de 1 à 90 lignes (tous les cas de bas de page)", async () => {
    let checked = 0;
    for (let n = 1; n <= 90; n += 1) {
      const body = Array.from({ length: n }, (_, i) => `Article ${i + 1} : le prestataire s'engage à fournir le service décrit.`).join("\r\n");
      const pdf = await generateContractPdf(contract({ contractTextSnapshot: body }));
      const lines = pdfLines(pdf);
      if (!lines) return;
      const pages = pdfPages(pdf);
      const title = lines.find((l) => l.text.startsWith("SIGNATURE"));
      const caption = lines.find((l) => /^Signé électroniquement par/.test(l.text));
      assert.ok(title && caption, `n=${n} : titre et légende de la signature`);
      assert.equal(title.page, caption.page, `n=${n} : titre et légende sur la même page`);
      const box = greenBox(pdf, title.page, title.yMax + 1, caption.yMin);
      if (!box) return;
      // Cadre entier (haut, bas, côtés) : proportions 3:1 de la zone de signature, et fini avant la légende.
      assert.ok(box.w > 150 && Math.abs(box.w / box.h - 3) < 0.25, `n=${n} : signature complète (${box.w.toFixed(0)}×${box.h.toFixed(0)} pt, page ${title.page}/${pages})`);
      assert.ok(box.bottom < caption.yMin, `n=${n} : la signature finit avant sa légende`);
      assert.ok(caption.yMax < 842 - 70, `n=${n} : la légende reste au-dessus du pied de page (${caption.yMax.toFixed(0)} pt)`);
      const footer = lines.find((l) => l.page === pages && l.text.includes("contact@africakani.com"));
      assert.ok(footer && footer.page === pages && caption.yMax < footer.yMin, `n=${n} : pied de page seul, sous la légende`);
      assert.equal(lines.filter((l) => l.text.startsWith("SIGNATURE")).length, 1, `n=${n} : une seule signature`);
      checked += 1;
    }
    assert.equal(checked, 90);
  });
});

function order(over: Record<string, unknown> = {}): OrderDetail {
  return {
    id: "AK-PDF1", createdAt: "2026-10-13T13:32:00.000Z", zoneId: "bj", subtotal: 25000, shippingFee: 0, customerName: "Awa Koné",
    customerPhone: "+229 97 00 00 00", status: "pending", paymentStatus: "pending", customerEmail: "awa@example.com",
    customerAddress: "Rue 12", customerCity: "Cotonou", customerApartment: null, customerProvince: null, customerPostalCode: null,
    customerCountry: "Bénin", paymentMethod: "mobile_money", mobileMoneyOperator: "MTN", mobileMoneyTransactionId: "TX123", paypalCaptureId: null,
    items: [{ productName: "Beurre de karité", quantity: 2, unitPrice: 12500, lineTotal: 25000 }], ...over,
  } as unknown as OrderDetail;
}

const pay = (id: string, amount: number, at: string | null, over: Partial<ServicePayment> = {}): ServicePayment => ({
  id, accountId: "SV-PDF00001", createdAt: at ?? "2026-11-01T10:00:00.000Z", amount, method: "mobile_money", status: at ? "confirme" : "soumis",
  source: "client", paidOn: (at ?? "2026-11-01").slice(0, 10), mmOperator: "MTN", mmPhone: "97000000", mmTransactionId: `TX-${id}`, reference: "",
  confirmedAt: at, rejectedAt: null, rejectReason: null, adminEmailSentAt: null, adminEmailError: null, receiptSentAt: null, receiptError: null, receiptClaimedAt: null, ...over,
});
function serviceAccount(over: Record<string, unknown> = {}, adjustmentReason = "Geste commercial"): ServiceAccountFull {
  const installments = [{ position: 1, label: "avant mise en ligne", dueDate: "2026-11-30" }, { position: 2, label: "mise en ligne", dueDate: "2026-12-30" }];
  const payments = [pay("SP-1", 5000, "2026-11-02T09:00:00.000Z")];
  const adjustments = [{ id: "A1", accountId: "SV-PDF00001", createdAt: "2026-11-03T10:00:00.000Z", kind: "reduction" as const, amount: 1000, reason: adjustmentReason }];
  const account = {
    id: "SV-PDF00001", createdAt: "2026-10-30T10:00:00.000Z", merchantName: "Volaille Djougou", clientName: "Awa Test", clientEmail: "awa@example.com",
    clientPhone: "+229 97 00 00 01", contractId: null, total: 100_000, deposit: 5000, installmentsCount: 2, goLiveDate: null, followupAmount: 3000,
    followupPeriod: "month" as const, note: "", tokenCreatedAt: "2026-10-30T10:00:00.000Z", ...over,
  };
  const state = computeAccountState({ total: account.total, deposit: 5000, installments, payments, adjustments, today: "2026-11-25" });
  return { account: account as ServiceAccountFull["account"], installments, payments, adjustments, state };
}

describe("factures PDF : aucun caractère parasite, champs saisis par des clients ou l'administrateur", () => {
  it("facture de commande : nom d'article, nom, adresse, courriel, téléphone avec retours Windows et caractères hostiles", async () => {
    const pdf = await generateInvoicePdf(order({
      customerName: HOSTILE, customerPhone: HOSTILE, customerEmail: HOSTILE, customerAddress: HOSTILE, customerCity: HOSTILE,
      mobileMoneyOperator: HOSTILE, mobileMoneyTransactionId: HOSTILE,
      items: [{ productName: HOSTILE, quantity: 2, unitPrice: 12500, lineTotal: 25000 }, { productName: "Savon\r\nnoir\r\n", quantity: 1, unitPrice: 2000, lineTotal: 2000 }],
    }));
    const text = pdfText(pdf);
    assert.equal(pdfPages(pdf), 1);
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
    assert.ok(/Savon/.test(text) && /noir/.test(text), "les deux lignes du nom sont écrites");
  });
  it("facture de commande normale : les montants gardent leurs espaces (pas de « / »)", async () => {
    const text = pdfText(await generateInvoicePdf(order()));
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
    assert.ok(text.includes("25 000 FCFA") && !text.includes("/000"));
  });
  it("facture d'un dossier de service : marchand, client, courriel, téléphone, motif d'ajustement hostiles", async () => {
    const full = serviceAccount({ merchantName: HOSTILE, clientName: HOSTILE, clientEmail: HOSTILE, clientPhone: HOSTILE }, HOSTILE);
    const pdf = await generateServiceInvoicePdf(full, "2026-11-25");
    const text = pdfText(pdf);
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
  });
  it("facture d'un dossier de service normale : montants, signe moins (pas de guillemet à la place), aucun caractère parasite", async () => {
    const text = pdfText(await generateServiceInvoicePdf(serviceAccount(), "2026-11-25"));
    if (!text) return;
    assert.equal(forbiddenIn(text), null);
    assert.match(text, /Réductions\s+- 1 000 FCFA/);
    assert.ok(!text.includes("/000"));
  });
});

describe("même défaut dans le reste du dépôt : tout ce qui est écrit dans un PDF passe par pdfSafeText", () => {
  const files = ["src/lib/contract-pdf.ts", "src/lib/invoice-pdf.ts", "src/lib/service-invoice-pdf.ts", "src/lib/invoice-pdf-parts.ts"];
  it("chaque fichier qui fabrique un PDF utilise pdfSafeText / pdfOneLine / money", () => {
    for (const f of files) assert.match(read(f), /pdfSafeText|pdfOneLine|money\(/, f);
  });
  it("aucun autre fichier du dépôt ne crée de PDF (un nouveau PDF doit être ajouté ici)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && /from "pdfkit"|require\("pdfkit"\)/.test(read(rel))) hits.push(rel);
      }
    };
    walk("src");
    assert.deepEqual(hits.sort(), ["src/lib/contract-pdf.ts", "src/lib/invoice-pdf-parts.ts"]);
  });
  it("le contrat stocké n'est écrit nulle part par le code du PDF (lecture seule : ni INSERT ni UPDATE)", () => {
    for (const f of files) assert.ok(!/INSERT|UPDATE |DELETE FROM|getPool/.test(read(f)), f);
  });
});
