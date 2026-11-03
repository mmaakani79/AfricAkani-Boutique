// Date de signature : le fuseau est toujours écrit (« UTC »), la donnée stockée n'est jamais modifiée.
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatSignedAtUtc } from "@/lib/contract-datetime";
import { buildAdminContractEmail, buildClientContractEmail } from "@/lib/contract-email-content";
import { generateContractPdf } from "@/lib/contract-pdf";
import type { SignedContract } from "@/lib/contracts-db";
import { framedSignaturePng, pdfLines, pdfText } from "./pdf-helpers";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

function contract(createdAt: string): SignedContract {
  return {
    id: "CT-DATE-0001", createdAt, clientName: "Awa Koné", clientEmail: "awa@example.com", clientPhone: "+229 97 00 00 00",
    companyName: "", services: ["Site web"], projectDescription: "Un site.", budget: "", timeline: "", notes: "",
    contractTextSnapshot: "Texte du contrat.", signatureDataUrl: framedSignaturePng(),
    emails: { admin: { sentAt: null, error: null, claimedAt: null }, client: { sentAt: null, error: null, claimedAt: null } },
  };
}

describe("formatSignedAtUtc : date et heure de signature, fuseau écrit", () => {
  it("« 03 novembre 2026 à 21:44 UTC »", () => {
    assert.equal(formatSignedAtUtc("2026-11-03T21:44:00.000Z"), "03 novembre 2026 à 21:44 UTC");
  });
  it("toujours en UTC, quel que soit le fuseau du serveur ou du navigateur : 23 h 30 UTC reste le 3 novembre", () => {
    assert.equal(formatSignedAtUtc("2026-11-03T23:30:00.000Z"), "03 novembre 2026 à 23:30 UTC");
    assert.equal(formatSignedAtUtc("2026-11-04T00:05:00.000Z"), "04 novembre 2026 à 00:05 UTC");
  });
  it("jamais 24:xx, jamais d'AM/PM", () => {
    assert.equal(formatSignedAtUtc("2026-01-01T00:00:00.000Z"), "01 janvier 2026 à 00:00 UTC");
    assert.ok(!/AM|PM/.test(formatSignedAtUtc("2026-06-15T15:07:00.000Z")));
  });
  it("une date illisible ne casse pas le PDF", () => {
    assert.equal(formatSignedAtUtc("pas une date"), "date inconnue");
  });
  it("ne modifie rien : la donnée reste l'instant d'origine", () => {
    const c = contract("2026-11-03T21:44:00.000Z");
    const before = JSON.stringify(c);
    formatSignedAtUtc(c.createdAt);
    assert.equal(JSON.stringify(c), before);
  });
});

describe("PDF du contrat : le fuseau est affiché partout où la date de signature l'est", () => {
  it("en-tête et légende de la signature : « … à 21:44 UTC »", async () => {
    const pdf = await generateContractPdf(contract("2026-11-03T21:44:00.000Z"));
    const text = pdfText(pdf);
    if (!text) return;
    assert.match(text, /Signé le 03 novembre 2026 à 21:44 UTC/);
    assert.match(text, /Signé électroniquement par Awa Koné le 03 novembre 2026 à 21:44 UTC\./);
    const lines = pdfLines(pdf)!;
    const caption = lines.find((l) => /^Signé électroniquement par/.test(l.text))!;
    assert.ok(caption.text.endsWith("21:44 UTC."), caption.text);
  });
  it("un ancien contrat (autre date, 23 h 30 UTC) garde sa donnée : même jour, fuseau affiché", async () => {
    const text = pdfText(await generateContractPdf(contract("2025-02-28T23:30:00.000Z")));
    if (!text) return;
    assert.match(text, /Signé le 28 février 2025 à 23:30 UTC/);
    assert.match(text, /le 28 février 2025 à 23:30 UTC\./);
  });
});

describe("courriels du contrat : le fuseau est écrit", () => {
  const c = contract("2026-10-13T13:32:00.000Z");
  it("à l'administrateur : « (heure de Cotonou) » (inchangé)", () => {
    const text = buildAdminContractEmail(c, "https://x").lines.join("\n");
    assert.match(text, /Date de signature : 13 octobre 2026 à 14:32 \(heure de Cotonou\)/);
  });
  it("au client : « … à 14:32 (heure de Cotonou). » (le fuseau est maintenant écrit)", () => {
    const text = buildClientContractEmail(c).lines.join("\n");
    assert.match(text, /signé électroniquement le 13 octobre 2026 à 14:32 \(heure de Cotonou\)\./);
  });
});

describe("administration des contrats : même affichage que le PDF", () => {
  it("la liste utilise formatSignedAtUtc (plus de date sans fuseau)", () => {
    const code = read("src/app/admin/(protected)/contrats/contracts-list.tsx");
    assert.ok(code.includes("formatSignedAtUtc(contract.createdAt)"));
    assert.ok(!code.includes("new Date(contract.createdAt)"));
  });
  it("le PDF n'a plus aucune date de signature sans fuseau", () => {
    const code = read("src/lib/contract-pdf.ts");
    assert.ok(!code.includes("new Date(contract.createdAt)"));
    assert.equal(code.split("formatSignedAtUtc(contract.createdAt)").length - 1, 2);
  });
  it("le formateur ne lit ni n'écrit rien en base", () => {
    assert.ok(!/getPool|INSERT|UPDATE /.test(read("src/lib/contract-datetime.ts")));
  });
});
