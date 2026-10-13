// En-tête : le sélecteur de zone est soit dans la barre du haut (large écran), soit sur sa
// propre ligne dessous (mobile et tablette) — jamais les deux, jamais aucun. Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const header = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src/components/layout/header.tsx"), "utf8");

describe("en-tête : emplacement du sélecteur de zone", () => {
  it("dans la barre du haut seulement à partir de 1040 px (il y tient entièrement)", () => {
    assert.match(header, /<div className="hidden min-\[1040px\]:block">\s*<ZoneSwitcher \/>/);
  });

  it("sur sa propre ligne sous la barre en dessous de 1040 px, avec le même seuil", () => {
    assert.match(header, /bg-white py-2 min-\[1040px\]:hidden">\s*<Container>\s*<ZoneSwitcher \/>/);
  });

  it("exactement deux emplacements, chacun avec le même seuil (jamais les deux, jamais aucun)", () => {
    assert.equal((header.match(/<ZoneSwitcher \/>/g) ?? []).length, 2);
    assert.equal((header.match(/min-\[1040px\]/g) ?? []).length, 2);
    assert.ok(!/\bsm:(hidden|block)\b/.test(header), "l'ancien seuil 640 px ne doit plus piloter le sélecteur de zone");
  });

  it("les liens du menu restent en ligne dès 768 px et le bouton menu en dessous (inchangé)", () => {
    assert.match(header, /<nav className="hidden [^"]*md:flex/);
    assert.ok(fs.readFileSync(path.resolve(import.meta.dirname, "..", "src/components/layout/mobile-menu.tsx"), "utf8").includes("md:hidden"));
  });
});
