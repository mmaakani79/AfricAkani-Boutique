// Pied de page du site : le bloc « Le cœur de l'opération » donne la même adresse du fournisseur que le reste du site
// (une seule source dans le code : SUPPLIER_ADDRESS). Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { SUPPLIER_ADDRESS } from "@/lib/business-info";

const footer = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src/components/layout/footer.tsx"), "utf8");

describe("pied de page : adresse du fournisseur", () => {
  it("l'adresse est « Québec, Canada », sans ville ni rue", () => {
    assert.equal(SUPPLIER_ADDRESS, "Québec, Canada");
  });
  it("le bloc « Le cœur de l'opération » et la ligne Contact lisent la même constante", () => {
    assert.equal(footer.split("{SUPPLIER_ADDRESS}").length - 1, 2);
    const block = footer.slice(footer.indexOf("Le cœur de l"), footer.indexOf("<ProductRequestCard"));
    assert.ok(block.includes("{SUPPLIER_ADDRESS}"));
    assert.ok(block.includes("Le cœur de l&rsquo;opération"), "le titre du bloc reste inchangé");
  });
  it("plus aucun « Cotonou » dans le pied de page", () => {
    assert.ok(!/Cotonou/.test(footer));
  });
});
