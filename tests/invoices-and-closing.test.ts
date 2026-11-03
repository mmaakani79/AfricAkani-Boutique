// Bloc de conclusion centré (courriels, page, PDF), facture PDF des commandes (site dans le pied, une seule
// page même avec une ligne très longue) et facture PDF des dossiers de service. Lancer avec `npm test`.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { renderReceiptEmail } from "@/lib/email-html";
import { RECEIPT_SLOGAN } from "@/lib/receipt-slogan";
import { CONTRACT_REFUND_LINE, OVERDUE_TEXT, PROVIDER_LINE, buildServiceReceipt } from "@/lib/service-receipt";
import { INVOICE_FOOTER_LINE } from "@/lib/invoice-pdf-parts";
import { computeAccountState } from "@/lib/service-account-math";
import { generateServiceInvoicePdf, serviceInvoiceFilename, serviceInvoiceHeadline } from "@/lib/service-invoice-pdf";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import type { ServiceAccountFull, ServicePayment } from "@/lib/service-accounts-db";
import type { OrderDetail } from "@/lib/orders-db";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const nbsp = (t: string) => t.replace(/[  ]/g, " ");
const PAGE_CENTER = 595.28 / 2;

// ---------- PDF helpers (pdftotext) ----------
function pdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}
function pdfText(pdf: Buffer): string | null {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
  const file = path.join(dir, "f.pdf");
  fs.writeFileSync(file, pdf);
  try {
    return nbsp(execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }));
  } catch {
    return null; // pdftotext absent : les contrôles de texte sont ignorés, pas ceux du nombre de pages
  }
}
interface PdfLine { page: number; text: string; xMin: number; xMax: number; yMin: number }
function pdfLines(pdf: Buffer): PdfLine[] | null {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
  const file = path.join(dir, "f.pdf");
  fs.writeFileSync(file, pdf);
  let xml: string;
  try {
    xml = execFileSync("pdftotext", ["-bbox-layout", file, "-"], { encoding: "utf8" });
  } catch {
    return null;
  }
  const out: PdfLine[] = [];
  let page = 0;
  for (const chunk of xml.split("<page ").slice(1)) {
    page += 1;
    for (const m of chunk.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([\s\S]*?)<\/line>/g)) {
      const text = [...m[4].matchAll(/<word[^>]*>([^<]*)<\/word>/g)].map((w) => w[1]).join(" ").replace(/&amp;/g, "&").replace(/&#39;/g, "'");
      out.push({ page, text: nbsp(text), xMin: +m[1], xMax: +m[3], yMin: +m[2] });
    }
  }
  return out;
}
const centerOf = (l: PdfLine) => (l.xMin + l.xMax) / 2;

// ---------- 1. Courriels : le bloc de conclusion est centré, le détail reste à gauche ----------
describe("courriel de reçu : conclusion centrée, détail à gauche", () => {
  const { text, html } = renderReceiptEmail("Sujet", ["Montant payé : 5 000 FCFA", "Reste à payer : 95 000 FCFA"], [PROVIDER_LINE, "", CONTRACT_REFUND_LINE]);
  const closingStart = html.indexOf('data-receipt-closing="1"');
  const closingBlock = html.slice(closingStart, html.indexOf("</td>", closingStart));

  it("le bloc de conclusion est centré (align=\"center\" ET text-align:center), avec les mentions dedans", () => {
    assert.match(closingBlock, /align="center"/);
    assert.match(closingBlock, /text-align:center/);
    assert.ok(closingBlock.includes("Service fourni par AkaGest."));
    assert.ok(closingBlock.includes("Conditions de remboursement"));
    for (const p of closingBlock.matchAll(/<p [^>]*>/g)) assert.match(p[0], /text-align:center/);
    assert.ok(closingBlock.includes("Conditions de remboursement") && closingBlock.includes("Service fourni par AkaGest."));
  });
  it("le détail du reçu reste à gauche : hors du bloc centré, sans text-align:center", () => {
    assert.ok(!closingBlock.includes("Montant payé"));
    const detail = html.slice(html.indexOf("Montant payé") - 80, html.indexOf("Reste à payer") + 60);
    assert.ok(!/text-align:center/.test(detail));
  });
  it("ordre : détail, conclusion centrée, ligne de pied centrée, slogan centré (le dernier)", () => {
    const i = (s: string) => html.indexOf(s);
    assert.ok(i("Reste à payer") < i("data-receipt-closing") && i("data-receipt-closing") < i("Boutique généraliste africaine") && i("Boutique généraliste africaine") < i(RECEIPT_SLOGAN));
    const footer = html.slice(html.lastIndexOf("<td ", i("Boutique généraliste africaine")), i("Boutique généraliste africaine"));
    assert.match(footer, /align="center"/);
    assert.match(footer, /text-align:center/);
    const slogan = html.slice(html.lastIndexOf("<td ", i(RECEIPT_SLOGAN)), i(RECEIPT_SLOGAN));
    assert.match(slogan, /align="center"/);
  });
  it("texte brut : détail, conclusion, slogan (ordre et lignes vides inchangés)", () => {
    assert.equal(text, ["Montant payé : 5 000 FCFA", "Reste à payer : 95 000 FCFA", "", PROVIDER_LINE, "", CONTRACT_REFUND_LINE, "", RECEIPT_SLOGAN].join("\n"));
  });
  it("un courriel qui n'est pas un reçu n'est pas centré", async () => {
    const { renderEmailHtml } = await import("@/lib/email-html");
    const plain = renderEmailHtml("S", ["Bonjour"]);
    assert.ok(!plain.includes("data-receipt-closing") && !plain.includes("data-receipt-slogan"));
    const footer = plain.slice(plain.lastIndexOf("<td ", plain.indexOf("Boutique généraliste africaine")), plain.indexOf("Boutique généraliste africaine"));
    assert.ok(!/align="center"|text-align:center/.test(footer));
  });
});

describe("page privée et pages de confirmation : composant commun", () => {
  it("la conclusion de la page privée passe par ReceiptSlogan (centré), avant le slogan", () => {
    const page = read("src/app/paiement-service/[token]/page.tsx");
    assert.match(page, /<ReceiptSlogan>\s*<p>\{PROVIDER_LINE\}<\/p>\s*<\/ReceiptSlogan>/);
    const c = read("src/components/receipt-slogan.tsx");
    assert.match(c, /text-center/);
    assert.ok(c.indexOf("{children}") < c.indexOf("RECEIPT_SLOGAN}"), "la conclusion précède le slogan");
  });
});

// ---------- 2. « Échéance dépassée » ----------
describe("reçu : échéance déjà passée", () => {
  const payment = { id: "SP-1", amount: 5000, method: "mobile_money", mmOperator: "MTN", paidOn: "2026-12-05", confirmedAt: "2026-12-05T09:00:00.000Z", createdAt: "2026-12-05T08:00:00.000Z" };
  const next = { position: 1, kind: "installment" as const, label: "avant mise en ligne", dueDate: "2026-11-30", amount: 31_666 };
  const state = { adjustedTotal: 100_000, paid: 5000, remaining: 95_000, reductions: 0, next };
  const build = (asOf?: string) => buildServiceReceipt({ merchantName: "Volaille", clientName: "Awa", payment, state, deposit: false, asOf });

  it("échéance passée : « échéance dépassée » au lieu de la date, dans le courriel et dans WhatsApp", () => {
    const r = build();
    const t = nbsp(r.lines.join("\n"));
    assert.match(t, /Prochaine échéance : avant mise en ligne — échéance dépassée — 31 666 FCFA/);
    assert.ok(!t.includes("novembre 2026"));
    assert.ok(nbsp(r.whatsappText).includes("avant mise en ligne, échéance dépassée, 31 666 FCFA"));
    assert.ok(!r.whatsappText.includes("novembre 2026"));
    assert.equal(OVERDUE_TEXT, "échéance dépassée");
  });
  it("échéance à venir (ou du jour même) : la date, comme avant", () => {
    assert.match(nbsp(build("2026-11-30").lines.join("\n")), /Prochaine échéance : avant mise en ligne — 30 novembre 2026 — 31 666 FCFA/);
    assert.match(nbsp(build("2026-11-02").lines.join("\n")), /30 novembre 2026/);
  });
  it("par défaut, la référence est le jour du paiement confirmé (un reçu renvoyé plus tard dit la même chose)", () => {
    assert.match(build().lines.join("\n"), /échéance dépassée/);
    const early = buildServiceReceipt({ merchantName: "V", clientName: "A", payment: { ...payment, paidOn: "2026-11-02", confirmedAt: "2026-11-02T09:00:00.000Z" }, state, deposit: false });
    assert.match(nbsp(early.lines.join("\n")), /30 novembre 2026/);
  });
  it("l'acompte (sans date) et le dossier soldé ne sont pas touchés", () => {
    const dep = buildServiceReceipt({ merchantName: "V", clientName: "A", payment, state: { ...state, next: { ...next, kind: "deposit", label: "Acompte", dueDate: null } }, deposit: true });
    assert.match(dep.lines.join("\n"), /Prochaine échéance : Acompte — /);
    const done = buildServiceReceipt({ merchantName: "V", clientName: "A", payment, state: { ...state, remaining: 0, next: null }, deposit: false });
    assert.match(done.lines.join("\n"), /Votre dossier est soldé\. Merci !/);
  });
});

// ---------- 3. Facture PDF des commandes ----------
function order(items: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[], over: Record<string, unknown> = {}): OrderDetail {
  return {
    id: "AK-TEST1", createdAt: "2026-10-13T13:32:00.000Z", zoneId: "bj", subtotal: 25000, shippingFee: 0,
    customerName: "Awa Koné", customerPhone: "+229 97 00 00 00", status: "pending", paymentStatus: "pending",
    customerEmail: "awa@example.com", customerAddress: "Rue 12", customerCity: "Cotonou", customerApartment: null,
    customerProvince: null, customerPostalCode: null, customerCountry: "Bénin", paymentMethod: "mobile_money",
    mobileMoneyOperator: "MTN", mobileMoneyTransactionId: "TX123", paypalCaptureId: null, items, ...over,
  } as unknown as OrderDetail;
}
const LONG_WORDS = "Beurre de karité pur non raffiné extra long ".repeat(60);
const LONG_NO_SPACE = "X".repeat(900);

describe("facture PDF de commande", () => {
  it("la ligne de pied contient le site : « AfricAkani — Cotonou, Bénin · africakani.com · contact@africakani.com · WhatsApp … »", () => {
    assert.match(INVOICE_FOOTER_LINE, /^AfricAkani — Cotonou, Bénin · africakani\.com · contact@africakani\.com · WhatsApp \+1 514 867 3738$/);
  });
  it("le pied et le slogan sont dans le PDF, centrés, le slogan sous le pied", async () => {
    const pdf = await generateInvoicePdf(order([{ productName: "Beurre de karité", quantity: 2, unitPrice: 12500, lineTotal: 25000 }]));
    assert.equal(pdfPages(pdf), 1);
    const lines = pdfLines(pdf);
    if (!lines) return;
    const foot = lines.find((l) => l.text.includes("africakani.com"));
    const slogan = lines.find((l) => l.text === RECEIPT_SLOGAN);
    assert.ok(foot && slogan, "pied et slogan présents");
    assert.ok(foot.text.includes("Cotonou, Bénin · africakani.com · contact@africakani.com · WhatsApp +1 514 867 3738"), foot.text);
    assert.ok(slogan.yMin > foot.yMin, "le slogan est sous le pied");
    assert.ok(Math.abs(centerOf(foot) - PAGE_CENTER) < 3 && Math.abs(centerOf(slogan) - PAGE_CENTER) < 3, `centrés ${centerOf(foot)} ${centerOf(slogan)}`);
  });
  for (const [label, name] of [["une ligne d'article très longue (avec espaces)", LONG_WORDS], ["un nom d'article de 900 caractères sans espace", LONG_NO_SPACE]] as const) {
    it(`reste sur UNE page avec ${label}`, async () => {
      const pdf = await generateInvoicePdf(order([
        { productName: "Savon noir", quantity: 1, unitPrice: 2000, lineTotal: 2000 },
        { productName: name, quantity: 3, unitPrice: 12500, lineTotal: 37500 },
        { productName: "Miel", quantity: 1, unitPrice: 4000, lineTotal: 4000 },
      ]));
      assert.equal(pdfPages(pdf), 1);
      const text = pdfText(pdf);
      if (!text) return;
      assert.ok(text.includes(RECEIPT_SLOGAN) && text.includes("africakani.com"));
      assert.ok(text.includes("Miel"), "les lignes suivantes restent visibles");
      assert.ok(text.includes("…") || text.includes("..."), "le nom trop long est coupé avec « … »");
    });
  }
  it("nom, adresse et courriel du client très longs : toujours une page", async () => {
    const pdf = await generateInvoicePdf(order([{ productName: "Beurre", quantity: 1, unitPrice: 2000, lineTotal: 2000 }], {
      customerName: "Awa ".repeat(80), customerAddress: "Rue des palmiers ".repeat(60), customerEmail: `${"a".repeat(200)}@example.com`,
    }));
    assert.equal(pdfPages(pdf), 1);
  });
  it("beaucoup d'articles : la facture passe sur plusieurs pages, le slogan n'est que sur la dernière, sans page blanche", async () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ productName: `Article numéro ${i + 1}`, quantity: 1, unitPrice: 1000, lineTotal: 1000 }));
    const pdf = await generateInvoicePdf(order(items));
    const n = pdfPages(pdf);
    assert.ok(n >= 2 && n <= 4, `${n} pages`);
    const lines = pdfLines(pdf);
    if (!lines) return;
    const slogans = lines.filter((l) => l.text === RECEIPT_SLOGAN);
    assert.equal(slogans.length, 1);
    assert.equal(slogans[0].page, n);
    for (let p = 1; p <= n; p++) assert.ok(lines.some((l) => l.page === p && /Article numéro|TOTAL/.test(l.text)), `page ${p} non vide`);
  });
});

// ---------- 4. Facture PDF des dossiers de service ----------
const INSTALLMENTS = [
  { position: 1, label: "avant mise en ligne", dueDate: "2026-11-30" },
  { position: 2, label: "mise en ligne", dueDate: "2026-12-30" },
  { position: 3, label: "", dueDate: "2027-01-30" },
];
const pay = (id: string, amount: number, confirmedAt: string | null, over: Partial<ServicePayment> = {}): ServicePayment => ({
  id, accountId: "SV-TEST0001", createdAt: confirmedAt ?? "2026-11-01T10:00:00.000Z", amount, method: "mobile_money",
  status: confirmedAt ? "confirme" : "soumis", source: "client", paidOn: (confirmedAt ?? "2026-11-01").slice(0, 10),
  mmOperator: "MTN", mmPhone: "97000000", mmTransactionId: `TX-${id}`, reference: "", confirmedAt, rejectedAt: null,
  rejectReason: null, adminEmailSentAt: null, adminEmailError: null, receiptSentAt: null, receiptError: null, receiptClaimedAt: null, ...over,
});
function account(payments: ServicePayment[], today: string, adjustments: ServiceAccountFull["adjustments"] = [], over: Record<string, unknown> = {}): ServiceAccountFull {
  const acc = {
    id: "SV-TEST0001", createdAt: "2026-10-30T10:00:00.000Z", merchantName: "Volaille Djougou (TEST)", clientName: "Awa Test",
    clientEmail: "awa.test@example.com", clientPhone: "+229 97 00 00 01", contractId: null, total: 100_000, deposit: 5000,
    installmentsCount: 3, goLiveDate: null, followupAmount: 3000, followupPeriod: "month" as const, note: "",
    tokenCreatedAt: "2026-10-30T10:00:00.000Z", ...over,
  };
  const state = computeAccountState({ total: acc.total, deposit: 5000, installments: INSTALLMENTS, payments, adjustments, today });
  return { account: acc as ServiceAccountFull["account"], installments: INSTALLMENTS, payments, adjustments, state };
}
const DEPOSIT = pay("SP-DEPOSIT1", 5000, "2026-11-02T09:00:00.000Z");
const TRANCHE = pay("SP-TRANCHE1", 31_666, "2026-11-20T09:00:00.000Z", { method: "especes", mmOperator: null, source: "admin" });

describe("facture PDF d'un dossier de service", () => {
  it("titre : « Facture » avec le solde restant tant que tout n'est pas payé, jamais « soldé »", () => {
    assert.equal(nbsp(serviceInvoiceHeadline(63_334)), "Facture — solde restant à payer : 63 334 FCFA");
    assert.equal(serviceInvoiceHeadline(0), "Facture — dossier soldé");
  });
  it("nom de fichier sûr", () => {
    assert.equal(serviceInvoiceFilename("SV-TEST0001"), "facture-SV-TEST0001.pdf");
    assert.equal(serviceInvoiceFilename('SV/../"x'), "facture-SV..x.pdf".replace("..", ""));
  });

  it("dossier partiellement payé : toutes les rubriques demandées, une page", async () => {
    const full = account([DEPOSIT, TRANCHE, pay("SP-WAIT", 1000, null)], "2026-11-25");
    const pdf = await generateServiceInvoicePdf(full, "2026-11-25");
    assert.equal(pdfPages(pdf), 1);
    const text = pdfText(pdf);
    if (!text) return;
    for (const expected of [
      "FACTURE", "SV-TEST0001", "25 novembre 2026", "Facturé à".toUpperCase(), "Awa Test", "Boutique : Volaille Djougou (TEST)",
      "Facture — solde restant à payer : 63 334 FCFA",
      "PAIEMENTS CONFIRMÉS", "2 novembre 2026", "Acompte", "Mobile Money (MTN)", "SP-DEPOSIT1", "5 000 FCFA",
      "20 novembre 2026", "Espèces", "SP-TRANCHE1", "31 666 FCFA",
      "Paiement en attente de confirmation, non compté ci-dessus : 1 000 FCFA.",
      "Prix total", "100 000 FCFA", "Acompte prévu", "Total payé", "36 666 FCFA", "Reste à payer", "63 334 FCFA",
      "Prochaine échéance : mise en ligne — 30 décembre 2026 — 31 666 FCFA",
      "TRANCHES À VENIR", "Tranche 3", "30 janvier 2027",
      PROVIDER_LINE, CONTRACT_REFUND_LINE, RECEIPT_SLOGAN, "africakani.com",
    ]) assert.ok(text.includes(expected), `absent : ${expected}\n${text}`);
    assert.ok(!/dossier soldé/.test(text), "ne laisse pas croire que tout est payé");
    assert.ok(!text.includes("SP-WAIT"), "un paiement non confirmé n'est pas listé comme payé");
  });

  it("le lien privé du client ne figure JAMAIS dans le PDF", async () => {
    const full = account([DEPOSIT], "2026-11-25");
    const pdf = await generateServiceInvoicePdf(full, "2026-11-25");
    const text = pdfText(pdf);
    if (!text) return;
    assert.ok(!/paiement-service|https?:\/\/|vercel|[A-Za-z0-9_-]{40,}/.test(text), text);
    assert.ok(!pdf.toString("latin1").includes("paiement-service"));
  });

  it("dossier soldé : « Facture — dossier soldé », aucune tranche à venir, pas de « solde restant »", async () => {
    const full = account([DEPOSIT, pay("SP-ALL", 95_000, "2026-11-20T09:00:00.000Z")], "2026-11-25");
    const text = pdfText(await generateServiceInvoicePdf(full, "2026-11-25"));
    if (!text) return;
    assert.ok(text.includes("Facture — dossier soldé"));
    assert.ok(!/solde restant/.test(text));
    assert.ok(text.includes("Aucune tranche à venir"));
    assert.ok(text.includes("0 FCFA"));
  });

  it("aucun paiement confirmé : le dit clairement, avec tout le solde à payer", async () => {
    const text = pdfText(await generateServiceInvoicePdf(account([], "2026-11-25"), "2026-11-25"));
    if (!text) return;
    assert.ok(text.includes("Aucun paiement confirmé pour le moment."));
    assert.ok(text.includes("Facture — solde restant à payer : 100 000 FCFA"));
    assert.ok(text.includes("Prochaine échéance : Acompte"));
  });

  it("échéance passée : « échéance dépassée » et tranche « En retard »", async () => {
    const text = pdfText(await generateServiceInvoicePdf(account([DEPOSIT], "2026-12-05"), "2026-12-05"));
    if (!text) return;
    assert.ok(text.includes("Prochaine échéance : avant mise en ligne — échéance dépassée — 31 666 FCFA"));
    assert.ok(text.includes("En retard"));
  });

  it("réductions, corrections et remboursements restent visibles (jamais effacés)", async () => {
    const adjustments = [
      { id: "A1", accountId: "SV-TEST0001", createdAt: "2026-11-03T10:00:00.000Z", kind: "reduction" as const, amount: 10_000, reason: "Geste commercial" },
      { id: "A2", accountId: "SV-TEST0001", createdAt: "2026-11-04T10:00:00.000Z", kind: "correction" as const, amount: 2_000, reason: "Option ajoutée" },
    ];
    const text = pdfText(await generateServiceInvoicePdf(account([DEPOSIT], "2026-11-25", adjustments), "2026-11-25"));
    if (!text) return;
    assert.ok(/Réductions\s+- 10 000 FCFA/.test(text), "le signe moins s'affiche (pas de guillemet à la place)");
    for (const e of ["AJUSTEMENTS", "Geste commercial", "Option ajoutée", "Réductions", "Prix total ajusté", "92 000 FCFA", "Reste à payer", "87 000 FCFA"]) assert.ok(text.includes(e), e);
  });

  it("mise en page : en-tête vert « FACTURE », conclusion, pied et slogan centrés, slogan en dernier", async () => {
    const pdf = await generateServiceInvoicePdf(account([DEPOSIT, TRANCHE], "2026-11-25"), "2026-11-25");
    const lines = pdfLines(pdf);
    if (!lines) return;
    for (const t of [PROVIDER_LINE, CONTRACT_REFUND_LINE, RECEIPT_SLOGAN]) {
      const l = lines.find((x) => x.text === t);
      assert.ok(l, t);
      assert.ok(Math.abs(centerOf(l) - PAGE_CENTER) < 3, `${t} centré (${centerOf(l)})`);
    }
    const foot = lines.find((l) => l.text.includes("africakani.com"))!;
    assert.ok(Math.abs(centerOf(foot) - PAGE_CENTER) < 3);
    const slogan = lines.find((l) => l.text === RECEIPT_SLOGAN)!;
    assert.ok(slogan.yMin > foot.yMin);
    const detail = lines.find((l) => l.text.includes("2 novembre 2026"))!;
    assert.ok(detail && detail.xMin < 60, `le détail des paiements reste à gauche (${detail?.xMin})`);
  });

  it("noms très longs et nombreux paiements : lisible, pas de page blanche, slogan seulement sur la dernière page", async () => {
    const many = [DEPOSIT, ...Array.from({ length: 40 }, (_, i) => pay(`SP-M${i}`, 1000, `2026-11-${String(3 + (i % 20)).padStart(2, "0")}T09:00:00.000Z`))];
    const full = account(many, "2026-11-25", [], { merchantName: "Volaille ".repeat(80), clientName: "Awa ".repeat(80) });
    const pdf = await generateServiceInvoicePdf(full, "2026-11-25");
    const n = pdfPages(pdf);
    assert.ok(n >= 2 && n <= 4, `${n} pages`);
    const lines = pdfLines(pdf);
    if (!lines) return;
    const slogans = lines.filter((l) => l.text === RECEIPT_SLOGAN);
    assert.equal(slogans.length, 1);
    assert.equal(slogans[0].page, n);
    for (let p = 1; p <= n; p++) assert.ok(lines.filter((l) => l.page === p).length > 3, `page ${p} non vide`);
  });
});

describe("accès aux factures de service : le lien privé ou l'administrateur connecté", () => {
  it("la route du client lit le dossier par le lien secret, répond 404 sinon, sans cache ni référent", () => {
    const code = read("src/app/paiement-service/[token]/facture/route.ts");
    assert.match(code, /getServiceAccountByToken\(token\)/);
    assert.match(code, /if \(!full\) return NOT_FOUND\(\)/);
    for (const h of ["no-store", "no-referrer", "noindex, nofollow", "application/pdf"]) assert.ok(code.includes(h), h);
    assert.ok(!/POST|PUT|DELETE|PATCH/.test(code), "lecture seule");
  });
  it("la route de l'administrateur vérifie la session (le proxy laisse passer /api/admin)", () => {
    const code = read("src/app/api/admin/services/[id]/facture/route.ts");
    assert.match(code, /isAdminAuthed\(\)/);
    assert.ok(code.indexOf("isAdminAuthed") < code.indexOf("getServiceAccountFull"), "la session est vérifiée avant de lire le dossier");
    assert.match(code, /status: 401/);
    assert.ok(!/POST|PUT|DELETE|PATCH/.test(code));
  });
  it("les boutons « Télécharger la facture (PDF) » existent sur la page du client et dans le dossier admin", () => {
    assert.match(read("src/app/paiement-service/[token]/page.tsx"), /Télécharger la facture \(PDF\)/);
    assert.match(read("src/app/admin/(protected)/services/[id]/page.tsx"), /Télécharger la facture \(PDF\)/);
  });
  it("la facture ne lit ni ne journalise rien : pas d'écriture en base, aucun accès au jeton", () => {
    const code = read("src/lib/service-invoice-pdf.ts");
    assert.ok(!/INSERT|UPDATE|DELETE|sql`|getPool|token/i.test(code.replace(/\/\/.*$/gm, "")), "lecture seule, sans jeton");
  });
});
