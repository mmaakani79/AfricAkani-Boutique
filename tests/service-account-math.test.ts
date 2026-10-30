import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adjustmentAmountError,
  computeAccountState,
  splitAmount,
  todayInBenin,
  type MathAdjustment,
  type MathPayment,
} from "@/lib/service-account-math";

const TODAY = "2026-11-10";
const INSTALLMENTS_3 = [
  { position: 1, label: "avant mise en ligne", dueDate: "2026-11-30" },
  { position: 2, label: "mise en ligne", dueDate: "2026-12-30" },
  { position: 3, label: "fin du mois suivant", dueDate: "2027-01-30" },
];
const base = (over: Partial<Parameters<typeof computeAccountState>[0]> = {}) =>
  computeAccountState({
    total: 100_000,
    deposit: 5000,
    installments: INSTALLMENTS_3,
    payments: [],
    adjustments: [],
    today: TODAY,
    ...over,
  });
const paid = (amount: number, status: MathPayment["status"] = "confirme"): MathPayment => ({ amount, status });

describe("répartition en tranches", () => {
  it("la somme est toujours exacte, la dernière tranche absorbe l'arrondi", () => {
    assert.deepEqual(splitAmount(70_000, 3), [23_333, 23_333, 23_334]);
    assert.deepEqual(splitAmount(95_000, 2), [47_500, 47_500]);
    assert.deepEqual(splitAmount(95_000, 4), [23_750, 23_750, 23_750, 23_750]);
    for (const [amount, parts] of [[1, 3], [2, 4], [99_999, 4], [0, 3], [100_000, 3]] as const) {
      const out = splitAmount(amount, parts);
      assert.equal(out.length, parts);
      assert.equal(out.reduce((s, n) => s + n, 0), amount);
    }
  });
  it("un montant négatif donne des tranches nulles, jamais négatives", () => {
    assert.deepEqual(splitAmount(-50, 2), [0, 0]);
  });
});

describe("dossier neuf : 100 000 FCFA, acompte 5 000, 3 tranches", () => {
  const s = base();
  it("aucun paiement : tout reste à payer", () => {
    assert.equal(s.adjustedTotal, 100_000);
    assert.equal(s.paid, 0);
    assert.equal(s.remaining, 100_000);
    assert.equal(s.status, "en_cours");
  });
  it("l'acompte est la première ligne, déduite du total ; les tranches se partagent 95 000", () => {
    assert.deepEqual(s.schedule.map((l) => [l.position, l.kind, l.amount]), [
      [0, "deposit", 5000],
      [1, "installment", 31_666],
      [2, "installment", 31_666],
      [3, "installment", 31_668],
    ]);
    assert.equal(s.schedule.reduce((sum, l) => sum + l.amount, 0), 100_000);
  });
  it("la prochaine échéance est l'acompte tant qu'il n'est pas payé", () => {
    assert.deepEqual(s.next, { position: 0, kind: "deposit", label: "Acompte", dueDate: null, amount: 5000 });
  });
});

describe("premier versement de 5 000 FCFA", () => {
  it("soumis mais pas confirmé : il n'est pas compté", () => {
    const s = base({ payments: [paid(5000, "soumis")] });
    assert.equal(s.paid, 0);
    assert.equal(s.pending, 5000);
    assert.equal(s.remaining, 100_000);
    assert.equal(s.next?.kind, "deposit");
  });
  it("rejeté : jamais compté", () => {
    const s = base({ payments: [paid(5000, "rejete")] });
    assert.equal(s.paid, 0);
    assert.equal(s.pending, 0);
  });
  it("confirmé : reste 95 000, prochaine échéance = tranche 1", () => {
    const s = base({ payments: [paid(5000)] });
    assert.equal(s.paid, 5000);
    assert.equal(s.remaining, 95_000);
    assert.equal(s.schedule[0].status, "paye");
    assert.equal(s.next?.position, 1);
    assert.equal(s.next?.dueDate, "2026-11-30");
    assert.equal(s.next?.label, "avant mise en ligne");
    assert.equal(s.next?.amount, 31_666);
    assert.equal(s.status, "en_cours");
  });
});

describe("ajustements : des lignes visibles, jamais des suppressions", () => {
  const reduction: MathAdjustment = { kind: "reduction", amount: 25_000 };
  it("réduction de parrainage de 25 000 : total ajusté 75 000, tranches recalculées", () => {
    const s = base({ payments: [paid(5000)], adjustments: [reduction] });
    assert.equal(s.adjustedTotal, 75_000);
    assert.equal(s.reductions, 25_000);
    assert.equal(s.remaining, 70_000);
    assert.deepEqual(s.schedule.slice(1).map((l) => l.amount), [23_333, 23_333, 23_334]);
  });
  it("une correction dans un sens puis dans l'autre se compense, les deux lignes restent", () => {
    const adjustments: MathAdjustment[] = [
      { kind: "correction", amount: 10_000 },
      { kind: "correction", amount: -10_000 },
    ];
    const s = base({ adjustments });
    assert.equal(s.adjustedTotal, 100_000);
    assert.equal(adjustments.length, 2);
  });
  it("remboursement : l'argent rendu augmente le reste à payer", () => {
    const s = base({ payments: [paid(5000)], adjustments: [{ kind: "remboursement", amount: 5000 }] });
    assert.equal(s.paid, 0);
    assert.equal(s.remaining, 100_000);
    assert.equal(s.refunds, 5000);
    assert.equal(s.next?.kind, "deposit");
  });
  it("trop-perçu : le reste n'est jamais négatif, l'excédent est signalé", () => {
    const s = base({ payments: [paid(5000), paid(100_000)] });
    assert.equal(s.remaining, 0);
    assert.equal(s.overpaid, 5000);
    assert.equal(s.status, "solde");
    assert.equal(s.next, null);
  });
  it("règles de saisie", () => {
    assert.equal(adjustmentAmountError("reduction", 25_000), null);
    assert.match(adjustmentAmountError("reduction", -25_000) ?? "", /positif/);
    assert.equal(adjustmentAmountError("correction", -3000), null);
    assert.equal(adjustmentAmountError("correction", 3000), null);
    assert.match(adjustmentAmountError("remboursement", -1) ?? "", /positif/);
    assert.match(adjustmentAmountError("correction", 0) ?? "", /nul/);
    assert.match(adjustmentAmountError("correction", 1.5) ?? "", /entier/);
  });
});

describe("tranches, retard et statut", () => {
  it("les paiements s'appliquent dans l'ordre : acompte, puis tranche 1, puis 2…", () => {
    const s = base({ payments: [paid(5000), paid(40_000)] });
    assert.deepEqual(s.schedule.map((l) => [l.position, l.paid, l.status]), [
      [0, 5000, "paye"],
      [1, 31_666, "paye"],
      [2, 8334, "partiel"],
      [3, 0, "a_payer"],
    ]);
    assert.equal(s.next?.position, 2);
    assert.equal(s.next?.amount, 31_666 - 8334);
  });
  it("tranche dont la date est dépassée et non couverte : en retard, dossier en retard", () => {
    const s = base({ payments: [paid(5000)], today: "2026-12-01" });
    assert.equal(s.schedule[1].status, "en_retard");
    assert.equal(s.status, "en_retard");
  });
  it("le jour même de l'échéance, ce n'est pas encore un retard", () => {
    const s = base({ payments: [paid(5000)], today: "2026-11-30" });
    assert.equal(s.schedule[1].status, "a_payer");
    assert.equal(s.status, "en_cours");
  });
  it("le retard disparaît quand la tranche est couverte", () => {
    const s = base({ payments: [paid(5000), paid(31_666)], today: "2026-12-01" });
    assert.equal(s.schedule[1].status, "paye");
    assert.equal(s.status, "en_cours");
  });
  it("tout payé : soldé", () => {
    const s = base({ payments: [paid(100_000)] });
    assert.equal(s.status, "solde");
    assert.equal(s.remaining, 0);
    assert.ok(s.schedule.every((l) => l.status === "paye"));
  });
  it("2 et 4 tranches", () => {
    const two = base({ installments: INSTALLMENTS_3.slice(0, 2) });
    assert.deepEqual(two.schedule.slice(1).map((l) => l.amount), [47_500, 47_500]);
    const four = base({ installments: [...INSTALLMENTS_3, { position: 4, label: "", dueDate: "2027-02-28" }] });
    assert.deepEqual(four.schedule.slice(1).map((l) => l.amount), [23_750, 23_750, 23_750, 23_750]);
  });
  it("les tranches sont classées par date, quel que soit l'ordre reçu", () => {
    const s = base({ installments: [...INSTALLMENTS_3].reverse(), payments: [paid(5000)] });
    assert.deepEqual(s.schedule.slice(1).map((l) => l.dueDate), ["2026-11-30", "2026-12-30", "2027-01-30"]);
  });
  it("réduction plus grande que le reste : tranches à 0, jamais négatives", () => {
    const s = base({ adjustments: [{ kind: "reduction", amount: 99_000 }] });
    assert.ok(s.schedule.every((l) => l.amount >= 0));
    assert.equal(s.adjustedTotal, 1000);
  });
});

describe("date du jour au Bénin", () => {
  it("UTC+1 : à 23 h 30 UTC il est déjà le lendemain à Cotonou", () => {
    assert.equal(todayInBenin(Date.UTC(2026, 10, 10, 23, 30)), "2026-11-11");
    assert.equal(todayInBenin(Date.UTC(2026, 10, 10, 12, 0)), "2026-11-10");
  });
});
