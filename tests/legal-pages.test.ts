import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LEGAL_PAGES,
  LEGAL_PAGE_LIST,
  legalDescription,
  plainText,
  type LegalBlock,
  type LegalPage,
} from "@/lib/legal-content";
import { tokenizeInline } from "@/lib/legal-inline";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---- The validated text (tests/fixtures/pages-legales.md), parsed ---------------------------------

interface ParsedPage {
  n: number;
  title: string;
  path: string;
  blocks: LegalBlock[];
}

function parseFixture(source: string): ParsedPage[] {
  const pages: ParsedPage[] = [];
  const marker = /^=== PAGE (\d+) — (.+) \((\/[a-z-]+)\) ===$/;
  let current: { page: ParsedPage; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const { page, lines } = current;
    let list: string[] | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("- ")) {
        if (!list) {
          list = [];
          page.blocks.push({ type: "ul", items: list });
        }
        list.push(line.slice(2));
        continue;
      }
      list = null;
      if (line.trim() === "") continue;
      // A single line directly followed by text (no blank line) is a heading.
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== "") page.blocks.push({ type: "h2", text: line });
      else page.blocks.push({ type: "p", text: line });
    }
    pages.push(page);
    current = null;
  };
  for (const line of source.split("\n")) {
    const m = line.match(marker);
    if (m) {
      flush();
      current = { page: { n: Number(m[1]), title: m[2], path: m[3], blocks: [] }, lines: [] };
    } else if (line.startsWith("=== FIN")) {
      flush();
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return pages;
}

const FIXTURE = parseFixture(read("tests/fixtures/pages-legales.md"));
const BY_PATH = new Map<string, LegalPage>(LEGAL_PAGE_LIST.map((p) => [p.path, p]));

describe("les quatre textes sont ceux validés, mot pour mot", () => {
  it("le fichier de référence contient les 4 pages", () => {
    assert.deepEqual(
      FIXTURE.map((p) => [p.n, p.title, p.path]),
      [
        [1, "Mentions légales", "/mentions-legales"],
        [2, "Politique de confidentialité", "/confidentialite"],
        [3, "Conditions de vente", "/conditions-de-vente"],
        [4, "Livraison et retours", "/livraison-retours"],
      ]
    );
  });

  for (const ref of FIXTURE) {
    it(`page ${ref.n} « ${ref.title} » : titre, adresse et contenu identiques au texte validé`, () => {
      const page = BY_PATH.get(ref.path);
      assert.ok(page, `page ${ref.path} absente`);
      assert.equal(page.title, ref.title);
      assert.deepEqual(page.blocks, ref.blocks);
    });
  }

  it("l'ordre du pied de page est celui des quatre pages", () => {
    assert.deepEqual(
      LEGAL_PAGE_LIST.map((p) => p.path),
      ["/mentions-legales", "/confidentialite", "/conditions-de-vente", "/livraison-retours"]
    );
    assert.deepEqual(Object.values(LEGAL_PAGES).map((p) => p.path).sort(), [...LEGAL_PAGE_LIST.map((p) => p.path)].sort());
  });
});

describe("numéros de téléphone sur les pages légales", () => {
  // Le numéro est construit en morceaux : ce fichier ne le contient pas en toutes lettres.
  const FORBIDDEN = [
    new RegExp(["514", "867", "3738"].join("[\\s.\\-\\u00a0]*")),
    /\(514\)/,
    /\+?1?[\s.\-]?514[\s.\-]?867/,
  ];
  const textOf = (page: LegalPage) =>
    page.blocks.map((b) => (b.type === "ul" ? b.items.join("\n") : b.text)).join("\n");

  it("aucune page légale n'affiche ni ne mentionne le numéro 514 …, ni de ligne « Téléphone »", () => {
    for (const page of LEGAL_PAGE_LIST) {
      const text = textOf(page);
      for (const re of FORBIDDEN) assert.doesNotMatch(text, re, page.path);
      assert.doesNotMatch(text, /t[ée]l[ée]phone\s*:/i, `${page.path} : ligne « Téléphone »`);
    }
  });

  it("aucun fichier ajouté pour les pages légales ne contient ce numéro", () => {
    const files = [
      "src/lib/legal-content.ts",
      "src/lib/legal-inline.ts",
      "src/components/legal/legal-document.tsx",
      "src/app/mentions-legales/page.tsx",
      "src/app/confidentialite/page.tsx",
      "src/app/conditions-de-vente/page.tsx",
      "src/app/livraison-retours/page.tsx",
      "tests/fixtures/pages-legales.md",
    ];
    for (const file of files) {
      const src = read(file);
      for (const re of FORBIDDEN) assert.doesNotMatch(src, re, file);
    }
  });

  it("le numéro WhatsApp +229 01 62 33 33 35 reste tel quel, uniquement dans les conditions de vente", () => {
    const wa = "+229 01 62 33 33 35";
    const withNumber = LEGAL_PAGE_LIST.filter((p) => textOf(p).includes(wa)).map((p) => p.path);
    assert.deepEqual(withNumber, ["/conditions-de-vente"]);
    assert.ok(
      textOf(LEGAL_PAGES.conditionsDeVente).includes(
        "Commande possible aussi par WhatsApp, au +229 01 62 33 33 35 (Bénin) : les conditions de paiement vous sont alors précisées."
      )
    );
    assert.ok(textOf(LEGAL_PAGES.conditionsDeVente).includes("Pour toute question : info@africakani.com."));
  });
});

describe("affichage du texte : liens et courriels", () => {
  it("un lien [texte](adresse) s'affiche avec son texte, en lien externe", () => {
    assert.deepEqual(tokenizeInline("Site : [www.africakani.com](https://www.africakani.com)"), [
      { kind: "text", text: "Site : " },
      { kind: "link", text: "www.africakani.com", href: "https://www.africakani.com", external: true },
    ]);
  });

  it("un courriel devient un lien mailto, le point final reste du texte", () => {
    assert.deepEqual(tokenizeInline("Pour toute question : info@africakani.com."), [
      { kind: "text", text: "Pour toute question : " },
      { kind: "link", text: "info@africakani.com", href: "mailto:info@africakani.com", external: false },
      { kind: "text", text: "." },
    ]);
    const two = tokenizeInline("a@b.co et c@d.org");
    assert.equal(two.filter((p) => p.kind === "link").length, 2);
  });

  it("le texte affiché est le texte validé : seuls les liens [..](..) sont réduits à leur texte", () => {
    for (const page of LEGAL_PAGE_LIST) {
      for (const block of page.blocks) {
        const lines = block.type === "ul" ? block.items : [block.text];
        for (const line of lines) {
          assert.equal(tokenizeInline(line).map((p) => p.text).join(""), plainText(line));
        }
      }
    }
  });

  it("un texte sans lien reste d'un seul morceau", () => {
    assert.deepEqual(tokenizeInline("Les prix peuvent changer sans préavis."), [
      { kind: "text", text: "Les prix peuvent changer sans préavis." },
    ]);
  });

  it("la description de chaque page reprend son texte (aucune phrase ajoutée)", () => {
    assert.equal(legalDescription(LEGAL_PAGES.mentionsLegales), "AfricAkani est une boutique en ligne exploitée depuis le Québec, Canada.");
    assert.equal(legalDescription(LEGAL_PAGES.conditionsDeVente), "En passant commande sur africakani.com, vous acceptez les conditions suivantes.");
    assert.match(legalDescription(LEGAL_PAGES.livraisonRetours), /^Délai estimé : 1 à 2 semaines/);
    assert.match(legalDescription(LEGAL_PAGES.confidentialite), /^AfricAkani protège vos renseignements personnels/);
  });
});

describe("branchement : pages, pied de page, commande, plan du site", () => {
  it("chaque page existe, avec son titre, sa description et son adresse canonique", () => {
    for (const [dir, key] of [
      ["mentions-legales", "mentionsLegales"],
      ["confidentialite", "confidentialite"],
      ["conditions-de-vente", "conditionsDeVente"],
      ["livraison-retours", "livraisonRetours"],
    ] as const) {
      const src = read(`src/app/${dir}/page.tsx`);
      assert.match(src, new RegExp(`LEGAL_PAGES\\.${key}`));
      assert.match(src, /title: `\$\{page\.title\} — AfricAkani`/);
      assert.match(src, /canonical: page\.path/);
      assert.match(src, /<LegalDocument page=\{page\} \/>/);
      assert.doesNotMatch(src, /force-dynamic|use client/, "page statique, sans code navigateur");
    }
  });

  it("le pied de page affiche les quatre liens, sans dépendre de la zone", () => {
    const src = read("src/components/layout/footer.tsx");
    assert.match(src, /LEGAL_PAGE_LIST\.map/);
    assert.match(src, /data-testid="footer-legal-links"/);
    assert.doesNotMatch(src.slice(src.indexOf("footer-legal-links") - 200, src.indexOf("footer-legal-links") + 900), /zone|useZone/i);
  });

  it("le plan du site contient les quatre pages", () => {
    const src = read("src/app/sitemap.ts");
    assert.match(src, /LEGAL_PAGE_LIST\.map/);
  });

  it("la page de commande ajoute deux liens simples sous le bouton, sans toucher au paiement", () => {
    const src = read("src/app/commande/page.tsx");
    assert.match(src, /data-testid="order-legal-links"/);
    assert.match(src, /href="\/conditions-de-vente"/);
    assert.match(src, /href="\/confidentialite"/);
    // ouverts dans un nouvel onglet : le formulaire et ce qui est saisi ne sont jamais quittés
    const block = src.slice(src.indexOf('data-testid="order-legal-links"'), src.indexOf("</form>"));
    assert.equal(block.match(/target="_blank"/g)?.length, 2);
    assert.equal(block.match(/rel="noopener noreferrer"/g)?.length, 2);
    assert.doesNotMatch(block, /onClick|onSubmit|<button|handleSubmit/);
  });

  it("rien d'autre : aucune variable d'environnement, base de données, ni outil de statistiques dans les fichiers ajoutés", () => {
    for (const file of [
      "src/lib/legal-content.ts",
      "src/lib/legal-inline.ts",
      "src/components/legal/legal-document.tsx",
      "src/app/mentions-legales/page.tsx",
      "src/app/confidentialite/page.tsx",
      "src/app/conditions-de-vente/page.tsx",
      "src/app/livraison-retours/page.tsx",
    ]) {
      const src = read(file);
      assert.doesNotMatch(src, /process\.env|@vercel\/analytics|gtag|from "pg"|-db"/, file);
    }
  });
});
