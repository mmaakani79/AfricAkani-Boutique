import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONTRACT_REFUND_LINE,
  DEPOSIT_REFUND_LINES,
  PROVIDER_LINE,
  SERVICE_REPLY_TO,
  TRACKING_LINK_LINE,
  depositPaymentIds,
  isDepositReceipt,
  receiptRecipient,
  receiptWhatsappHref,
} from "@/lib/service-receipt";
import { computeAccountState } from "@/lib/service-account-math";
import { buildReceiptForPayment } from "@/lib/service-receipts";
import type { ServiceAccountFull, ServicePayment } from "@/lib/service-accounts-db";

/** Detail then concluding block: the whole text of a receipt. */
const allText = (r: { lines: string[]; closing: string[] }) => [...r.lines, "", ...r.closing].join("\n");

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const INSTALLMENTS = [
  { position: 1, label: "avant mise en ligne", dueDate: "2026-11-30" },
  { position: 2, label: "mise en ligne", dueDate: "2026-12-30" },
  { position: 3, label: "", dueDate: "2027-01-30" },
];
const pay = (id: string, amount: number, confirmedAt: string | null, over: Partial<ServicePayment> = {}): ServicePayment => ({
  id,
  accountId: "SV-TEST0001",
  createdAt: confirmedAt ?? "2026-11-01T10:00:00.000Z",
  amount,
  method: "mobile_money",
  status: confirmedAt ? "confirme" : "soumis",
  source: "client",
  paidOn: (confirmedAt ?? "2026-11-01").slice(0, 10),
  mmOperator: "MTN",
  mmPhone: "97000000",
  mmTransactionId: `TX-${id}`,
  reference: "",
  confirmedAt,
  rejectedAt: null,
  rejectReason: null,
  adminEmailSentAt: null,
  adminEmailError: null,
  receiptSentAt: null,
  receiptError: null,
  receiptClaimedAt: null,
  ...over,
});

function fullAccount(payments: ServicePayment[], adjustments: ServiceAccountFull["adjustments"] = [], deposit = 5000): ServiceAccountFull {
  const account = {
    id: "SV-TEST0001",
    createdAt: "2026-10-30T10:00:00.000Z",
    merchantName: "Volaille Djougou (TEST)",
    clientName: "Awa Test",
    clientEmail: "awa.test@example.com",
    clientPhone: "+229 97 00 00 01",
    contractId: null,
    total: 100_000,
    deposit,
    installmentsCount: 3,
    goLiveDate: null,
    followupAmount: 3000,
    followupPeriod: "month" as const,
    note: "",
    tokenCreatedAt: "2026-10-30T10:00:00.000Z",
  };
  const state = computeAccountState({ total: 100_000, deposit, installments: INSTALLMENTS, payments, adjustments, today: "2026-11-10" });
  return { account, installments: INSTALLMENTS, payments, adjustments, state };
}

const DEPOSIT = pay("SP-DEPOSIT1", 5000, "2026-11-02T09:00:00.000Z");
const TRANCHE = pay("SP-TRANCHE1", 31_666, "2026-11-20T09:00:00.000Z", { method: "especes", mmOperator: null, source: "admin" });

describe("reçu de l'acompte", () => {
  const r = buildReceiptForPayment(fullAccount([DEPOSIT, TRANCHE]), "SP-DEPOSIT1");
  it("existe, avec l'objet attendu", () => {
    assert.ok(r);
    assert.equal(r.subject.replace(/[\u202f\u00a0]/g, " "), "Reçu de paiement — Volaille Djougou (TEST) — 5 000 FCFA");
  });
  it("montant, date, moyen, numéro de reçu", () => {
    const t = allText(r!);
    assert.match(t, /Bonjour Awa Test,/);
    assert.match(t, /Nous avons bien reçu votre acompte/);
    assert.match(t, /Reçu n° SP-DEPOSIT1/);
    assert.match(t, /Montant payé : 5\s000\sFCFA/);
    assert.match(t, /Date : 2 novembre 2026/);
    assert.match(t, /Moyen : Mobile Money \(MTN\)/);
  });
  it("situation du dossier AU MOMENT de l'acompte (le paiement de la tranche, plus tard, n'est pas compté)", () => {
    const t = allText(r!).replace(/[  ]/g, " ");
    assert.match(t, /Prix total : 100 000 FCFA/);
    assert.match(t, /Déjà payé : 5 000 FCFA/);
    assert.match(t, /Reste à payer : 95 000 FCFA/);
    assert.match(t, /Prochaine échéance : avant mise en ligne — 30 novembre 2026 — 31 666 FCFA/);
  });
  it("rappelle la règle de l'acompte et la fourniture par AkaGest, pas la phrase des tranches", () => {
    const t = allText(r!);
    assert.ok(t.includes(PROVIDER_LINE));
    for (const line of DEPOSIT_REFUND_LINES) assert.ok(t.includes(line), line);
    assert.ok(!t.includes(CONTRACT_REFUND_LINE));
    assert.match(t, /seulement si AkaGest ne livre pas le service/);
    assert.match(t, /gardé par AkaGest si le client abandonne/);
    assert.match(t, /boutique de produits AfricAkani ne s'appliquent pas à ce service/);
  });
});

describe("reçu d'une tranche", () => {
  const r = buildReceiptForPayment(fullAccount([DEPOSIT, TRANCHE]), "SP-TRANCHE1");
  it("aucune règle de remboursement, seulement le renvoi au contrat signé", () => {
    const t = allText(r!);
    assert.ok(t.includes("Conditions de remboursement : celles de votre contrat signé."));
    for (const line of DEPOSIT_REFUND_LINES) assert.ok(!t.includes(line), line);
    assert.doesNotMatch(t, /acompte est remboursé|gardé par AkaGest/);
    assert.match(t, /Nous avons bien reçu votre paiement\./);
    assert.match(t, /Moyen : Espèces/);
  });
  it("la situation inclut l'acompte et cette tranche", () => {
    const t = allText(r!).replace(/[  ]/g, " ");
    assert.match(t, /Déjà payé : 36 666 FCFA/);
    assert.match(t, /Reste à payer : 63 334 FCFA/);
    assert.match(t, /Prochaine échéance : mise en ligne — 30 décembre 2026 — 31 666 FCFA/);
  });
  it("une tranche sans étiquette s'appelle « Tranche N »", () => {
    const full = fullAccount([DEPOSIT, TRANCHE, pay("SP-T2", 31_666, "2026-12-01T09:00:00.000Z")]);
    const r2 = buildReceiptForPayment(full, "SP-T2");
    assert.match(allText(r2!), /Prochaine échéance : Tranche 3 — 30 janvier 2027/);
  });
});

describe("dans tous les reçus", () => {
  const all = [
    buildReceiptForPayment(fullAccount([DEPOSIT, TRANCHE]), "SP-DEPOSIT1")!,
    buildReceiptForPayment(fullAccount([DEPOSIT, TRANCHE]), "SP-TRANCHE1")!,
  ];
  it("la phrase sur le lien de suivi (jamais le lien lui-même)", () => {
    for (const r of all) {
      const t = allText(r);
      assert.ok(t.includes("Votre lien de suivi vous a été envoyé par WhatsApp. En cas de perte, demandez-en un nouveau."));
      assert.ok(t.includes(TRACKING_LINK_LINE));
      assert.doesNotMatch(t, /paiement-service|https?:\/\//i);
    }
  });
  it("aucun numéro 514 …, aucun secret", () => {
    for (const r of all) assert.doesNotMatch(allText(r) + r.whatsappText, /514[\s.\-]*867|token|secret|mot de passe/i);
  });
  it("les réponses vont à contact@akagest.com", () => {
    assert.equal(SERVICE_REPLY_TO, "contact@akagest.com");
    assert.match(read("src/lib/service-receipts.ts"), /replyTo: SERVICE_REPLY_TO/);
    assert.match(read("src/lib/email.ts"), /replyTo: params\.replyTo,/);
  });
  it("dossier soldé : « Votre dossier est soldé. Merci ! »", () => {
    const paid = pay("SP-ALL", 100_000, "2026-11-25T09:00:00.000Z");
    const r = buildReceiptForPayment(fullAccount([paid]), "SP-ALL")!;
    assert.match(allText(r), /Votre dossier est soldé\. Merci !/);
    assert.doesNotMatch(allText(r), /Prochaine échéance/);
  });
  it("réduction accordée : le total est dit « après réductions »", () => {
    const adj = [{ id: "SA-1", accountId: "SV-TEST0001", createdAt: "2026-11-01T00:00:00.000Z", kind: "reduction" as const, amount: 25_000, reason: "Parrainage" }];
    const r = buildReceiptForPayment(fullAccount([DEPOSIT], adj), "SP-DEPOSIT1")!;
    assert.match(allText(r).replace(/[  ]/g, " "), /Prix total \(après réductions\) : 75 000 FCFA/);
  });
  it("un paiement non confirmé n'a pas de reçu", () => {
    assert.equal(buildReceiptForPayment(fullAccount([DEPOSIT, pay("SP-WAIT", 100, null)]), "SP-WAIT"), null);
    assert.equal(buildReceiptForPayment(fullAccount([DEPOSIT]), "SP-INCONNU"), null);
  });
});

describe("message WhatsApp", () => {
  const r = buildReceiptForPayment(fullAccount([DEPOSIT]), "SP-DEPOSIT1")!;
  const t = r.whatsappText.replace(/[  ]/g, " ");
  it("contenu court : montant, date, reste, échéance, AkaGest, règle de l'acompte", () => {
    assert.match(t, /^Bonjour Awa, AkaGest a bien reçu votre acompte de 5 000 FCFA le 2 novembre 2026 \(reçu SP-DEPOSIT1\)\./);
    assert.match(t, /Reste à payer : 95 000 FCFA\./);
    assert.match(t, /Prochaine échéance : avant mise en ligne, 30 novembre 2026, 31 666 FCFA\./);
    assert.match(t, /Service fourni par AkaGest\. /);
    assert.match(t, /Acompte remboursé seulement si AkaGest ne livre pas ; gardé si le client abandonne le projet\./);
  });
  it("le reçu d'une tranche renvoie au contrat, sans règle d'acompte", () => {
    const x = buildReceiptForPayment(fullAccount([DEPOSIT, TRANCHE]), "SP-TRANCHE1")!.whatsappText;
    assert.ok(x.includes(CONTRACT_REFUND_LINE));
    assert.doesNotMatch(x, /Acompte remboursé/);
  });
  it("lien WhatsApp vers le numéro du client, texte encodé ; rien sans numéro", () => {
    const href = receiptWhatsappHref("+229 97 00 00 01", r.whatsappText);
    assert.ok(href?.startsWith("https://wa.me/22997000001?text="));
    assert.equal(decodeURIComponent(href!.split("?text=")[1]), r.whatsappText);
    assert.equal(receiptWhatsappHref("", r.whatsappText), null);
    assert.equal(receiptWhatsappHref("123", r.whatsappText), null);
  });
});

describe("l'acompte est le paiement qui règle l'acompte prévu du dossier", () => {
  it("détecte le reçu de l'acompte, pas celui des tranches ni d'un paiement non confirmé", () => {
    const list = [TRANCHE, DEPOSIT, pay("SP-WAIT", 100, null)];
    assert.equal(isDepositReceipt(list, "SP-DEPOSIT1", 5000), true);
    assert.equal(isDepositReceipt(list, "SP-TRANCHE1", 5000), false);
    assert.equal(isDepositReceipt(list, "SP-WAIT", 5000), false);
  });
});

describe("règles de l'acompte liées à l'acompte PRÉVU du dossier (pas au premier paiement confirmé)", () => {
  const rules = (full: ServiceAccountFull, id: string) => {
    const r = buildReceiptForPayment(full, id)!;
    const t = allText(r);
    return { deposit: DEPOSIT_REFUND_LINES.every((l) => t.includes(l)), contract: t.includes(CONTRACT_REFUND_LINE), r };
  };
  const classic = fullAccount([DEPOSIT, TRANCHE]);

  it("cas habituel : l'acompte de 5 000 a les règles de l'acompte, la tranche renvoie au contrat", () => {
    assert.deepEqual([rules(classic, "SP-DEPOSIT1").deposit, rules(classic, "SP-DEPOSIT1").contract], [true, false]);
    assert.deepEqual([rules(classic, "SP-TRANCHE1").deposit, rules(classic, "SP-TRANCHE1").contract], [false, true]);
  });

  it("le premier paiement confirmé n'est PAS l'acompte prévu (acompte prévu : 0) : aucun reçu n'a les règles de l'acompte", () => {
    const full = fullAccount([DEPOSIT, TRANCHE], [], 0);
    for (const id of ["SP-DEPOSIT1", "SP-TRANCHE1"]) {
      const x = rules(full, id);
      assert.deepEqual([x.deposit, x.contract], [false, true], id);
      assert.ok(!allText(x.r).includes("Remboursement de l'acompte"), id);
    }
  });

  it("l'acompte se règle en deux versements (2 000 puis 3 000) : les deux reçus ont les règles de l'acompte, le suivant non", () => {
    const full = fullAccount([
      pay("SP-A1", 2000, "2026-11-02T09:00:00.000Z"),
      pay("SP-A2", 3000, "2026-11-04T09:00:00.000Z"),
      pay("SP-B1", 10_000, "2026-11-06T09:00:00.000Z"),
    ]);
    assert.equal(rules(full, "SP-A1").deposit, true);
    assert.equal(rules(full, "SP-A2").deposit, true);
    assert.deepEqual([rules(full, "SP-B1").deposit, rules(full, "SP-B1").contract], [false, true]);
  });

  it("un paiement soumis ou rejeté d'abord ne compte pas : le premier paiement CONFIRMÉ règle l'acompte", () => {
    const rejected = pay("SP-REJ", 5000, null, { status: "rejete", rejectedAt: "2026-11-01T12:00:00.000Z", rejectReason: "introuvable" });
    const full = fullAccount([rejected, pay("SP-WAIT", 5000, null), DEPOSIT, TRANCHE]);
    assert.equal(rules(full, "SP-DEPOSIT1").deposit, true);
    assert.equal(rules(full, "SP-TRANCHE1").deposit, false);
  });

  it("le premier paiement confirmé est plus grand que l'acompte (une tranche réglée avant l'acompte) : il règle l'acompte prévu, le suivant renvoie au contrat", () => {
    const full = fullAccount([TRANCHE, pay("SP-LATE5K", 5000, "2026-11-25T09:00:00.000Z")]);
    assert.equal(rules(full, "SP-TRANCHE1").deposit, true, "ce paiement couvre l'acompte prévu (premier élément de l'échéancier)");
    const next = rules(full, "SP-LATE5K");
    assert.deepEqual([next.deposit, next.contract], [false, true]);
  });

  it("la règle suit l'acompte prévu au moment du paiement : une réduction qui l'annule ne change pas les reçus déjà émis", () => {
    const before = rules(classic, "SP-DEPOSIT1").deposit;
    const reduced = fullAccount([DEPOSIT, TRANCHE], [{ id: "A1", accountId: "SV-TEST0001", createdAt: "2026-12-01T09:00:00.000Z", kind: "reduction", amount: 10_000, reason: "geste" }]);
    assert.equal(rules(reduced, "SP-DEPOSIT1").deposit, before);
  });

  it("depositPaymentIds : ordre chronologique, quel que soit l'ordre de la liste", () => {
    const ids = depositPaymentIds([TRANCHE, pay("SP-A2", 3000, "2026-11-04T09:00:00.000Z"), pay("SP-A1", 2000, "2026-11-02T09:00:00.000Z")], 5000);
    assert.deepEqual([...ids].sort(), ["SP-A1", "SP-A2"]);
    assert.equal(depositPaymentIds([TRANCHE], 0).size, 0);
  });
});

describe("prévisualisation : jamais vers un vrai client", () => {
  it("en production, le reçu va au client", () => {
    assert.deepEqual(receiptRecipient({ deploymentEnv: "production", clientEmail: "awa@example.com", adminEmail: "moi@example.com" }), { to: "awa@example.com", testNotice: [] });
  });
  it("sur le Preview, il va à l'administrateur et le dit clairement", () => {
    const r = receiptRecipient({ deploymentEnv: "preview", clientEmail: "awa@example.com", adminEmail: "moi@example.com" });
    assert.equal(r.to, "moi@example.com");
    assert.match(r.testNotice.join("\n"), /PAS été envoyé au client/);
    assert.match(r.testNotice.join("\n"), /awa@example\.com/);
  });
  it("le chemin d'envoi passe toujours par cette règle", () => {
    const src = read("src/lib/service-receipts.ts");
    assert.match(src, /receiptRecipient\(/);
    assert.match(src, /getDeploymentEnv\(\)/);
    assert.match(src, /\[TEST\]/);
  });
});
