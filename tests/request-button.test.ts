// Bouton « Faire une demande » du pied de page : plein, doré de la marque, sans
// reste de l'ancienne bordure ondulée. Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const component = fs.readFileSync(path.join(ROOT, "src/components/shop/product-request-modal.tsx"), "utf8");

/** Tout le CSS dont le sélecteur commence par .request-btn (blocs simples ou dans un @media). */
const requestCss = css.slice(css.indexOf(".request-btn {"), css.indexOf("/* ---- Bandeau de livraison"));

describe("couleurs : uniquement les dorés déjà présents sur le site", () => {
  it("la teinte vient des variables de la marque, aucune nouvelle couleur dorée écrite en dur", () => {
    assert.match(requestCss, /var\(--color-gold\)/);
    assert.match(requestCss, /var\(--color-gold-light\)/);
    const hexColors = requestCss.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    // seuls le blanc et le noir (utilisés pour éclaircir/foncer le doré de la marque)
    for (const hex of hexColors) assert.match(hex, /^#(fff|ffffff|000)$/i, `couleur en dur inattendue : ${hex}`);
  });

  it("dégradé léger entre deux tons dérivés du doré, avec repli en couleur pleine", () => {
    assert.match(requestCss, /--request-top: color-mix\(in srgb, var\(--color-gold\), #fff/);
    assert.match(requestCss, /--request-bottom: color-mix\(in srgb, var\(--color-gold\), #000/);
    const solid = requestCss.indexOf("background: var(--color-gold);");
    const gradient = requestCss.indexOf("background: linear-gradient(180deg");
    assert.ok(solid >= 0 && gradient > solid, "repli plein avant le dégradé");
  });

  it("texte blanc avec une très légère ombre, bordure dorée plus claire, ombre douce dessous", () => {
    assert.match(requestCss, /color: #ffffff;/);
    assert.match(requestCss, /text-shadow: 0 1px 1px rgba\(0, 0, 0, 0\.25\)/);
    assert.match(requestCss, /border: 1px solid var\(--color-gold-light\)/);
    assert.match(requestCss, /box-shadow:[^;]*0 6px 14px/);
  });
});

describe("états", () => {
  it("survol : monte d'un cran et s'éclaircit, seulement sur les appareils à souris", () => {
    assert.match(requestCss, /@media \(hover: hover\)[\s\S]*\.request-btn:hover[\s\S]*translateY\(-1px\)[\s\S]*brightness\(1\.07\)/);
  });

  it("appui : s'enfonce de 2 px, plus sombre, ombre resserrée — aussi via data-pressed (toucher)", () => {
    assert.match(requestCss, /\.request-btn:active,\s*\.request-btn\[data-pressed="true"\]\s*\{[^}]*translateY\(2px\)[^}]*brightness\(0\.93\)[^}]*inset 0 2px 3px/);
    assert.match(component, /onPointerDown=\{\(\) => setPressed\(true\)\}/);
    assert.match(component, /onPointerCancel=\{\(\) => setPressed\(false\)\}/);
  });

  it("clavier : contour doré clair net", () => {
    assert.match(requestCss, /\.request-btn:focus-visible\s*\{[^}]*outline: 2px solid var\(--color-gold-light\)/);
  });

  it("transition rapide (150 ms), sans rebond", () => {
    assert.match(requestCss, /transform 150ms ease-out/);
    assert.ok(!/cubic-bezier|bounce|spring/.test(requestCss));
  });

  it("« réduire les animations » : plus aucun mouvement, les changements de couleur restent", () => {
    const reduced = requestCss.slice(requestCss.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(reduced, /transform: none/);
    assert.ok(!/transition:[^;]*transform/.test(reduced.slice(0, reduced.indexOf("transform: none"))));
    assert.match(reduced, /filter 150ms/);
  });
});

describe("ancien bouton ondulé supprimé, contenu et fonctionnement conservés", () => {
  it("plus aucune trace du contour ondulé (CSS, clip-paths, animations)", () => {
    assert.ok(!/scallop/i.test(css));
    assert.ok(!/scallop/i.test(component));
    assert.ok(!/#2bff88/i.test(css));
  });

  it("icône d'enveloppe à gauche, texte « Faire une demande », ouvre toujours la même fenêtre de demande", () => {
    assert.match(component, /<Mail className="h-\[18px\] w-\[18px\]" aria-hidden \/>\s*Faire une demande/);
    assert.match(component, /onClick=\{\(\) => setOpen\(true\)\}/);
    assert.match(component, /<ProductRequestDialog onClose=\{\(\) => setOpen\(false\)\} \/>/);
  });
});
