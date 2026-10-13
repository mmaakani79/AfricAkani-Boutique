// Page « Nos services », bloc « Parlons de votre projet » : plus de bouton « Copier l'adresse »,
// boutons WhatsApp / e-mail / contrat au style du bouton « Faire une demande ». Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const page = read("src/app/services/page.tsx");
const css = read("src/app/globals.css");
const block = page.slice(page.indexOf("Parlons de votre projet"));

function allFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? allFiles(rel) : [rel];
  });
}

describe("« Copier l'adresse » n'existe plus", () => {
  it("ni le texte, ni le composant, ni le fichier, ni le presse-papiers dans tout le code", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, "src/app/services/copy-email-button.tsx")), "fichier supprimé");
    for (const f of allFiles("src").filter((f) => /\.(ts|tsx|css)$/.test(f))) {
      const code = read(f);
      assert.ok(!/Copier l(['’]|&rsquo;|&#39;)adresse|Adresse copiée|CopyEmailButton|copy-email-button/.test(code), f);
    }
    assert.ok(!/navigator\.clipboard/.test(allFiles("src/app/services").map(read).join("\n")));
  });

  it("l'adresse reste affichée, en petit texte simple (pas un bouton, pas un lien)", () => {
    assert.match(block, /<p className="mt-5 text-sm text-white">\{EMAIL\}<\/p>/);
  });
});

describe("boutons du bloc : même style que « Faire une demande »", () => {
  it("WhatsApp et e-mail sont conservés et utilisent le bouton doré", () => {
    assert.match(block, /<GoldLink href=\{WHATSAPP_HREF\} external>[\s\S]*Écrire sur WhatsApp[\s\S]*<\/GoldLink>/);
    assert.match(block, /<GoldLink href=\{`mailto:\$\{EMAIL\}`\}>[\s\S]*Envoyer un e-mail[\s\S]*<\/GoldLink>/);
    assert.match(block, /MessageCircle/);
    assert.match(block, /<Mail /);
  });

  it("le composant porte la classe du bouton du pied de page, et l'effet d'appui du toucher", () => {
    const link = read("src/app/services/gold-link.tsx");
    assert.match(link, /className="request-btn request-btn--link"/);
    assert.match(link, /onPointerDown=\{\(\) => setPressed\(true\)\}/);
    assert.match(link, /onPointerCancel=\{\(\) => setPressed\(false\)\}/);
    assert.match(link, /rel: "noopener noreferrer"/);
  });

  it("le style (dégradé doré bronze, blanc, 0,15 s, mouvement réduit) est celui du bouton existant, pas une copie", () => {
    assert.equal((css.match(/\.request-btn \{\s*--request-top/g) ?? []).length, 1, "une seule définition du dégradé du bouton");
    assert.match(css, /\.request-btn--link \{[^}]*width: auto;/);
    assert.ok(!/\.request-btn--link[^{]*\{[^}]*(background|color:|transition|box-shadow)/.test(css), "la variante ne change que la taille");
    assert.match(css, /transform 150ms ease-out/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });
});

describe("« Projet déjà cadré ? » et le bouton vers le contrat", () => {
  it("la phrase est un texte simple, lisible (blanc, jamais grisé), au-dessus du bouton", () => {
    const sentence = block.match(/<p className="([^"]*)">Projet déjà cadré \?<\/p>/);
    assert.ok(sentence, "phrase dans son propre paragraphe");
    assert.match(sentence[1], /\btext-white\b/);
    assert.ok(!/text-white\/\d|text-ink\/|opacity|text-gray/.test(sentence[1]), "pas de gris pâle : " + sentence[1]);
    assert.ok(block.indexOf("Projet déjà cadré") < block.indexOf('href="/contrat"'), "phrase avant le bouton");
  });

  it("la phrase et le lien ne forment plus une seule ligne de texte", () => {
    const paragraph = block.match(/<p className="[^"]*">Projet déjà cadré \?<\/p>/)![0];
    assert.ok(!/<a\b|GoldLink/.test(paragraph));
    assert.ok(!/Projet déjà cadré \?\{" "\}/.test(block));
  });

  it("le bouton « Remplir le cahier des charges et signer le contrat » mène à /contrat, avec une flèche", () => {
    assert.match(block, /<GoldLink href="\/contrat">\s*Remplir le cahier des charges et signer le contrat\s*<ArrowRight [^>]*aria-hidden \/>\s*<\/GoldLink>/);
    assert.match(page, /ArrowRight,/);
  });

  it("la cible /contrat existe", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "src/app/contrat/page.tsx")));
  });
});
