// Règle des reçus d'un dossier de service : les règles de remboursement de l'acompte vont avec l'acompte PRÉVU du
// dossier (5 000 FCFA par défaut), pas avec « le premier paiement ». Cas limites : exactement l'acompte, juste en
// dessous, juste au-dessus, plus grand, tout d'un coup, client ayant déjà payé, acompte remboursé puis repayé.
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAccountState } from "@/lib/service-account-math";
import { CONTRACT_REFUND_LINE, DEPOSIT_REFUND_LINES, depositPaymentIds } from "@/lib/service-receipt";
import { buildReceiptForPayment } from "@/lib/service-receipts";
import { generateServiceInvoicePdf } from "@/lib/service-invoice-pdf";
import type { ServiceAccountFull, ServicePayment } from "@/lib/service-accounts-db";
import { pdfText } from "./pdf-helpers";

const INSTALLMENTS = [
  { position: 1, label: "avant mise en ligne", dueDate: "2026-12-30" },
  { position: 2, label: "mise en ligne", dueDate: "2027-01-30" },
  { position: 3, label: "", dueDate: "2027-02-28" },
];

// Paiements du 2 au 20 novembre 2026, un par jour, dans l'ordre où ils sont confirmés.
const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T09:00:00.000Z`;
function pay(id: string, amount: number, day: number | null, over: Partial<ServicePayment> = {}): ServicePayment {
  const when = day === null ? null : at(day);
  return {
    id, accountId: "SV-EDGE0001", createdAt: when ?? at(1), amount, method: "mobile_money", status: when ? "confirme" : "soumis", source: "client",
    paidOn: (when ?? at(1)).slice(0, 10), mmOperator: "MTN", mmPhone: "97000000", mmTransactionId: `TX-${id}`, reference: "", confirmedAt: when,
    rejectedAt: null, rejectReason: null, adminEmailSentAt: null, adminEmailError: null, receiptSentAt: null, receiptError: null, receiptClaimedAt: null, ...over,
  };
}
const adj = (id: string, kind: "reduction" | "correction" | "remboursement", amount: number, day: number) => ({
  id, accountId: "SV-EDGE0001", createdAt: at(day), kind, amount, reason: "test",
});

function account(payments: ServicePayment[], adjustments: ServiceAccountFull["adjustments"] = [], total = 100_000, deposit = 5000): ServiceAccountFull {
  const acc = {
    id: "SV-EDGE0001", createdAt: "2026-10-30T10:00:00.000Z", merchantName: "Volaille Djougou", clientName: "Awa Test", clientEmail: "awa@example.com",
    clientPhone: "+229 97 00 00 01", contractId: null, total, deposit, installmentsCount: 3, goLiveDate: null, followupAmount: 3000,
    followupPeriod: "month" as const, note: "", tokenCreatedAt: "2026-10-30T10:00:00.000Z",
  };
  const state = computeAccountState({ total, deposit, installments: INSTALLMENTS, payments, adjustments, today: "2026-11-25" });
  return { account: acc, installments: INSTALLMENTS, payments, adjustments, state };
}

const plain = (t: string) => t.replace(/[  ]/g, " ");
/** « deposit » : les règles de l'acompte ; « contract » : seulement le renvoi au contrat signé. */
function kind(full: ServiceAccountFull, id: string): "deposit" | "contract" {
  const r = buildReceiptForPayment(full, id)!;
  const text = [...r.lines, ...r.closing].join("\n");
  const deposit = DEPOSIT_REFUND_LINES.every((l) => text.includes(l));
  const contract = text.includes(CONTRACT_REFUND_LINE);
  assert.notEqual(deposit, contract, `${id} : exactement un des deux textes de remboursement`);
  return deposit ? "deposit" : "contract";
}
const nextLine = (full: ServiceAccountFull, id: string) =>
  plain(buildReceiptForPayment(full, id)!.lines.find((l) => l.startsWith("Prochaine échéance") || l.startsWith("Votre dossier est soldé")) ?? "");

describe("acompte : exactement 5 000 FCFA", () => {
  const full = account([pay("P1", 5000, 2), pay("P2", 31_666, 10)]);
  it("le reçu des 5 000 FCFA porte les règles de l'acompte, le suivant renvoie au contrat", () => {
    assert.equal(kind(full, "P1"), "deposit");
    assert.equal(kind(full, "P2"), "contract");
  });
  it("après l'acompte : reste 95 000 FCFA, prochaine échéance = la 1re tranche en entier", () => {
    assert.match(nextLine(full, "P1"), /Prochaine échéance : avant mise en ligne — 30 décembre 2026 — 31 666 FCFA/);
    assert.ok(plain(buildReceiptForPayment(full, "P1")!.lines.join("\n")).includes("Reste à payer : 95 000 FCFA"));
  });
});

describe("acompte : juste en dessous (4 999 FCFA)", () => {
  const full = account([pay("P1", 4999, 2), pay("P2", 1, 4), pay("P3", 31_666, 10)]);
  it("l'acompte n'est pas encore réglé : le reçu des 4 999 FCFA porte les règles de l'acompte et demande 1 FCFA", () => {
    assert.equal(kind(full, "P1"), "deposit");
    assert.match(nextLine(full, "P1"), /Prochaine échéance : Acompte — 1 FCFA/);
  });
  it("le paiement de 1 FCFA qui complète l'acompte porte aussi les règles de l'acompte ; ensuite plus", () => {
    assert.equal(kind(full, "P2"), "deposit");
    assert.match(nextLine(full, "P2"), /Prochaine échéance : avant mise en ligne — 30 décembre 2026 — 31 666 FCFA/);
    assert.equal(kind(full, "P3"), "contract");
  });
});

describe("acompte : juste au-dessus (5 001 FCFA)", () => {
  const full = account([pay("P1", 5001, 2), pay("P2", 31_665, 10)]);
  it("un seul paiement règle l'acompte (5 000) et 1 FCFA de la 1re tranche : règles de l'acompte", () => {
    assert.equal(kind(full, "P1"), "deposit");
    assert.match(nextLine(full, "P1"), /Prochaine échéance : avant mise en ligne — 30 décembre 2026 — 31 665 FCFA/);
  });
  it("le paiement suivant renvoie au contrat (l'acompte est déjà réglé)", () => {
    assert.equal(kind(full, "P2"), "contract");
    assert.match(nextLine(full, "P2"), /Prochaine échéance : mise en ligne — 30 janvier 2027 — 31 666 FCFA/);
  });
});

describe("acompte : premier paiement beaucoup plus grand", () => {
  it("une tranche entière (31 666 FCFA) payée d'abord règle l'acompte prévu : règles de l'acompte, puis contrat", () => {
    const full = account([pay("P1", 31_666, 2), pay("P2", 5000, 10)]);
    assert.equal(kind(full, "P1"), "deposit");
    assert.equal(kind(full, "P2"), "contract");
  });
  it("tout le dossier payé d'un coup (100 000 FCFA) : règles de l'acompte, dossier soldé", () => {
    const full = account([pay("P1", 100_000, 2)]);
    assert.equal(kind(full, "P1"), "deposit");
    assert.match(nextLine(full, "P1"), /Votre dossier est soldé\. Merci !/);
  });
});

describe("acompte : client qui a déjà payé", () => {
  const first = pay("P1", 5001, 2);
  const later = [pay("P2", 20_000, 10), pay("P3", 30_000, 12)];
  const after = [adj("A1", "reduction", 10_000, 14), adj("A2", "correction", 2_000, 15), adj("A3", "remboursement", 1_000, 16)];

  it("ses reçus déjà émis ne changent pas quand d'autres paiements arrivent ensuite (texte identique, mot pour mot)", () => {
    const before = buildReceiptForPayment(account([first]), "P1")!;
    const now = buildReceiptForPayment(account([first, ...later]), "P1")!;
    assert.deepEqual(now, before);
  });
  it("…ni quand des réductions, corrections ou remboursements sont ajoutés ensuite", () => {
    const before = buildReceiptForPayment(account([first, ...later]), "P1")!;
    const now = buildReceiptForPayment(account([first, ...later], after), "P1")!;
    assert.deepEqual(now, before);
    assert.equal(kind(account([first, ...later], after), "P2"), "contract");
  });
  it("un reçu renvoyé plus tard dit exactement la même chose", () => {
    const full = account([first, ...later], after);
    assert.deepEqual(buildReceiptForPayment(full, "P1"), buildReceiptForPayment(full, "P1"));
    assert.equal(kind(full, "P1"), "deposit");
  });
  it("un paiement en attente ou rejeté n'a pas de reçu et ne change rien aux autres", () => {
    const full = account([pay("W", 100, null), pay("R", 5000, null, { status: "rejete", rejectedAt: at(3), rejectReason: "introuvable" }), first, ...later]);
    assert.equal(buildReceiptForPayment(full, "W"), null);
    assert.equal(buildReceiptForPayment(full, "R"), null);
    assert.equal(kind(full, "P1"), "deposit");
    assert.equal(kind(full, "P2"), "contract");
  });
});

describe("acompte : remboursé puis repayé, ou ramené par une réduction", () => {
  it("l'acompte est remboursé (5 000) : l'échéancier le redemande, et le paiement qui le règle de nouveau porte les règles de l'acompte", () => {
    const full = account([pay("P1", 5000, 2), pay("P3", 5000, 12)], [adj("A1", "remboursement", 5000, 8)]);
    // Avant le nouveau paiement, après le remboursement : l'acompte est de nouveau dû (l'échéancier le redemande).
    const afterRefund = account([pay("P1", 5000, 2)], [adj("A1", "remboursement", 5000, 8)]);
    assert.equal(afterRefund.state.schedule[0].status, "a_payer");
    assert.equal(afterRefund.state.next?.kind, "deposit");
    assert.equal(kind(full, "P1"), "deposit");
    assert.equal(kind(full, "P3"), "deposit");
  });
  it("remboursement partiel (2 000) : le paiement de 3 000 qui complète l'acompte porte les règles ; un paiement de plus non", () => {
    const full = account([pay("P1", 5000, 2), pay("P2", 3000, 12), pay("P3", 31_666, 14)], [adj("A1", "remboursement", 2000, 8)]);
    assert.equal(kind(full, "P2"), "deposit");
    assert.equal(kind(full, "P3"), "contract");
  });
  it("remboursement fait APRÈS le paiement suivant : l'ordre des événements compte (le 2e paiement reste un paiement normal)", () => {
    const full = account([pay("P1", 5000, 2), pay("P2", 10_000, 6)], [adj("A1", "remboursement", 5000, 9)]);
    assert.equal(kind(full, "P2"), "contract");
  });
  it("une réduction qui ramène le prix sous l'acompte : l'acompte prévu devient le prix (3 000), ce paiement porte les règles", () => {
    const full = account([pay("P1", 3000, 12)], [adj("A1", "reduction", 97_000, 8)]);
    assert.equal(kind(full, "P1"), "deposit");
  });
  it("depositPaymentIds : sans remboursement, résultat identique à la règle simple", () => {
    const list = [pay("P1", 2000, 2), pay("P2", 3000, 4), pay("P3", 9000, 6)];
    assert.deepEqual([...depositPaymentIds(list, 5000)].sort(), ["P1", "P2"]);
    assert.deepEqual([...depositPaymentIds(list, 5000, [])].sort(), ["P1", "P2"]);
    assert.equal(depositPaymentIds(list, 0).size, 0);
  });
});

describe("facture PDF du dossier : « Acompte » / « Paiement » suit la même règle", () => {
  it("4 999 + 1 FCFA = acompte (deux lignes « Acompte »), puis « Paiement »", async () => {
    const text = pdfText(await generateServiceInvoicePdf(account([pay("P1", 4999, 2), pay("P2", 1, 4), pay("P3", 31_666, 10)]), "2026-11-25"));
    if (!text) return;
    const rows = text.split("\n").filter((l) => /^\d+ novembre 2026/.test(l.trim()));
    assert.deepEqual(rows.map((l) => (/Acompte/.test(l) ? "Acompte" : /Paiement/.test(l) ? "Paiement" : "?")), ["Acompte", "Acompte", "Paiement"], rows.join("\n"));
  });
  it("5 001 FCFA = un seul « Acompte », le suivant « Paiement »", async () => {
    const text = pdfText(await generateServiceInvoicePdf(account([pay("P1", 5001, 2), pay("P2", 100, 4)]), "2026-11-25"));
    if (!text) return;
    const rows = text.split("\n").filter((l) => /^\d+ novembre 2026/.test(l.trim()));
    assert.deepEqual(rows.map((l) => (/Acompte/.test(l) ? "Acompte" : /Paiement/.test(l) ? "Paiement" : "?")), ["Acompte", "Paiement"], rows.join("\n"));
  });
});
