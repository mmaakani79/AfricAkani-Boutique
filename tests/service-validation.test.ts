import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  isValidIsoDate,
  parseAdjustment,
  parseAdminPayment,
  parseClientContact,
  parseMobileMoneySubmission,
  parseNewAccountInput,
  parseWholeAmount,
} from "@/lib/service-validation";
import { generateServiceToken, hashServiceToken, isPlausibleServiceToken, randomServiceId } from "@/lib/service-token";

describe("montants et dates", () => {
  it("montants entiers, avec espaces tolérés", () => {
    assert.equal(parseWholeAmount("5 000"), 5000);
    assert.equal(parseWholeAmount("100000"), 100_000);
    assert.equal(parseWholeAmount("-25000"), -25_000);
    for (const bad of ["12.5", "abc", "", "1e3", "5 000 FCFA", null, undefined, 1.5, "9".repeat(20)]) {
      assert.equal(parseWholeAmount(bad), null, String(bad));
    }
  });
  it("dates réelles seulement", () => {
    assert.ok(isValidIsoDate("2026-11-30"));
    for (const bad of ["2026-02-30", "2026-13-01", "30/11/2026", "", undefined, "2026-1-1"]) assert.ok(!isValidIsoDate(bad), String(bad));
  });
  it("ajout de mois, fin de mois courte comprise", () => {
    assert.equal(addMonths("2026-11-15", 12), "2027-11-15");
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2027-12-31", 2), "2028-02-29");
  });
});

describe("création d'un dossier", () => {
  const good = {
    merchantName: "  Volaille Djougou (TEST) ",
    total: "100 000",
    deposit: "5000",
    installmentCount: "3",
    labels: ["avant mise en ligne", "", "solde"],
    dates: ["2026-11-30", "2026-12-30", "2027-01-30"],
    goLiveDate: "2026-12-15",
    contractId: "CT-1",
  };
  it("accepte une saisie valide et la nettoie", () => {
    const r = parseNewAccountInput(good);
    assert.ok(r.ok);
    assert.equal(r.value.merchantName, "Volaille Djougou (TEST)");
    assert.equal(r.value.total, 100_000);
    assert.equal(r.value.deposit, 5000);
    assert.equal(r.value.installments.length, 3);
    assert.equal(r.value.followupAmount, 3000);
    assert.equal(r.value.followupPeriod, "month");
    assert.equal(r.value.goLiveDate, "2026-12-15");
  });
  it("acompte par défaut 5 000 FCFA", () => {
    const r = parseNewAccountInput({ ...good, deposit: undefined });
    assert.ok(r.ok);
    assert.equal(r.value.deposit, 5000);
  });
  it("refuse : nom vide, total invalide, acompte > total, 1 ou 5 tranches, dates manquantes ou dans le désordre", () => {
    for (const bad of [
      { merchantName: " " },
      { total: "0" },
      { total: "abc" },
      { deposit: "200000" },
      { installmentCount: "1" },
      { installmentCount: "5" },
      { dates: ["2026-11-30", "", "2027-01-30"] },
      { dates: ["2026-12-30", "2026-11-30", "2027-01-30"] },
      { goLiveDate: "demain" },
      { followupAmount: "-5" },
    ]) {
      const r = parseNewAccountInput({ ...good, ...bad });
      assert.ok(!r.ok, JSON.stringify(bad));
      assert.ok(r.error.length > 10);
    }
  });
  it("mensualité 5 000 par trimestre acceptée", () => {
    const r = parseNewAccountInput({ ...good, followupAmount: "5000", followupPeriod: "quarter" });
    assert.ok(r.ok);
    assert.equal(r.value.followupAmount, 5000);
    assert.equal(r.value.followupPeriod, "quarter");
  });
});

describe("versement Mobile Money du client", () => {
  const good = { operatorId: "mtn", phone: "+229 97 00 00 00", transactionId: "MP260101.1234.A56789", amount: "5000" };
  it("accepte une saisie valide", () => {
    const r = parseMobileMoneySubmission(good);
    assert.ok(r.ok);
    assert.equal(r.value.amount, 5000);
  });
  it("refuse numéro trop court, identifiant absent ou bizarre, montant faux", () => {
    for (const bad of [
      { phone: "1234" },
      { phone: "abcdefgh" },
      { transactionId: "" },
      { transactionId: "ab" },
      { transactionId: "<script>alert(1)</script>" },
      { amount: "0" },
      { amount: "5000.5" },
      { operatorId: "" },
    ]) {
      assert.ok(!parseMobileMoneySubmission({ ...good, ...bad }).ok, JSON.stringify(bad));
    }
  });
});

describe("paiement enregistré par l'admin et ajustements", () => {
  it("paiement : montant, moyen et date obligatoires", () => {
    assert.ok(parseAdminPayment({ amount: "5000", method: "especes", paidOn: "2026-11-10" }).ok);
    assert.ok(!parseAdminPayment({ amount: "5000", method: "bitcoin", paidOn: "2026-11-10" }).ok);
    assert.ok(!parseAdminPayment({ amount: "5000", method: "especes", paidOn: "10/11/2026" }).ok);
    assert.ok(!parseAdminPayment({ amount: "-5", method: "especes", paidOn: "2026-11-10" }).ok);
  });
  it("ajustement : motif obligatoire, signe selon le type", () => {
    assert.ok(parseAdjustment({ kind: "reduction", amount: "25000", reason: "Parrainage" }).ok);
    assert.ok(parseAdjustment({ kind: "correction", amount: "-3000", reason: "Erreur de saisie" }).ok);
    assert.ok(!parseAdjustment({ kind: "reduction", amount: "25000", reason: "" }).ok);
    assert.ok(!parseAdjustment({ kind: "reduction", amount: "-25000", reason: "x" }).ok);
    assert.ok(!parseAdjustment({ kind: "autre", amount: "1", reason: "x" }).ok);
  });
});

describe("lien secret", () => {
  it("256 bits, forme fixe, jamais deux fois le même", () => {
    const a = generateServiceToken();
    const b = generateServiceToken();
    assert.notEqual(a, b);
    assert.ok(isPlausibleServiceToken(a));
    assert.equal(a.length, 43);
  });
  it("seule l'empreinte est gardée : stable, différente du jeton, 64 caractères", () => {
    const t = generateServiceToken();
    assert.equal(hashServiceToken(t), hashServiceToken(t));
    assert.notEqual(hashServiceToken(t), t);
    assert.match(hashServiceToken(t), /^[0-9a-f]{64}$/);
    assert.notEqual(hashServiceToken(t), hashServiceToken(generateServiceToken()));
  });
  it("une valeur qui n'a pas la forme d'un jeton est écartée avant toute recherche", () => {
    for (const bad of ["", "abc", "a".repeat(42), "a".repeat(44), "../../etc/passwd", "a".repeat(42) + "!", "SV-7K3Q9XM2"]) {
      assert.ok(!isPlausibleServiceToken(bad), bad);
    }
  });
  it("identifiants courts sans caractères ambigus", () => {
    for (let i = 0; i < 50; i++) assert.match(randomServiceId("SV"), /^SV-[A-HJKMNP-Z2-9]{8}$/);
  });
});

describe("coordonnées du client (reçus)", () => {
  it("accepte un contact complet, ou vide", () => {
    const r = parseClientContact({ clientName: " Awa Test ", clientEmail: " AWA.Test@Example.com ", clientPhone: "+229 97 00 00 01" });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { clientName: "Awa Test", clientEmail: "awa.test@example.com", clientPhone: "+229 97 00 00 01" });
    const empty = parseClientContact({});
    assert.ok(empty.ok);
    assert.deepEqual(empty.value, { clientName: "", clientEmail: "", clientPhone: "" });
  });
  it("refuse une adresse ou un numéro invalide", () => {
    for (const email of ["pas-une-adresse", "a@b", "a b@c.com", "<x>@c.com"]) assert.ok(!parseClientContact({ clientEmail: email }).ok, email);
    for (const phone of ["abc", "12", "+", "97 00 <b>"]) assert.ok(!parseClientContact({ clientPhone: phone }).ok, phone);
  });
  it("la création d'un dossier garde ces coordonnées", () => {
    const r = parseNewAccountInput({
      merchantName: "Marchand",
      clientName: "Awa",
      clientEmail: "awa@example.com",
      clientPhone: "+22997000001",
      total: "100000",
      installmentCount: "2",
      dates: ["2026-11-30", "2026-12-30"],
    });
    assert.ok(r.ok);
    assert.equal(r.value.clientEmail, "awa@example.com");
    assert.equal(r.value.clientPhone, "+22997000001");
    assert.ok(!parseNewAccountInput({ merchantName: "Marchand", clientEmail: "faux", total: "100000", installmentCount: "2", dates: ["2026-11-30", "2026-12-30"] }).ok);
  });
});
