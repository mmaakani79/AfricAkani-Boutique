import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { filterAnalyticsEvent } from "@/lib/analytics-filter";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const SITE = "https://www.africakani.com";
const view = (url: string) => ({ type: "pageview" as const, url });

describe("filtre des statistiques : pages d'administration jamais comptées", () => {
  for (const url of [
    `${SITE}/admin`,
    `${SITE}/admin/`,
    `${SITE}/admin/login`,
    `${SITE}/admin/commandes`,
    `${SITE}/admin/commandes/AK-ABC123?tab=paiement`,
    `${SITE}/admin?x=1#y`,
    `${SITE}/ADMIN/produits`,
    "/admin/reglages",
    "http://localhost:4602/admin/produits",
  ]) {
    it(`${url} : non envoyé`, () => assert.equal(filterAnalyticsEvent(view(url)), null));
  }

  it("une page publique dont le nom commence comme « admin » est comptée", () => {
    for (const url of [`${SITE}/administration`, `${SITE}/adminx/y`, `${SITE}/produit/admin`]) {
      assert.deepEqual(filterAnalyticsEvent(view(url)), view(url));
    }
  });
});

describe("filtre des statistiques : tout ce qui suit « ? » ou « # » est retiré", () => {
  const cases: [string, string][] = [
    [`${SITE}/suivi?commande=AK-MV8HTLW5`, `${SITE}/suivi`],
    [`${SITE}/noter?commande=AK-MV8HTLW5`, `${SITE}/noter`],
    [`${SITE}/commande/succes?session_id=cs_test_a1B2c3`, `${SITE}/commande/succes`],
    [`${SITE}/commande/succes?token=5O190127TN364715T&PayerID=ABC`, `${SITE}/commande/succes`],
    [`${SITE}/commande/succes?order_id=AK-MV8HTLW5`, `${SITE}/commande/succes`],
    [`${SITE}/catalogue?q=savon+noir&categorie=beurres&halal=oui`, `${SITE}/catalogue`],
    [`${SITE}/notre-histoire#benin`, `${SITE}/notre-histoire`],
    [`${SITE}/produit/beurre-de-karite-pur?utm_source=x#avis`, `${SITE}/produit/beurre-de-karite-pur`],
    [`${SITE}/?preview=secret`, `${SITE}/`],
    [`${SITE}`, `${SITE}/`],
    ["/suivi?commande=AK-1", "/suivi"],
    ["http://localhost:4602/compte?a=b", "http://localhost:4602/compte"],
  ];
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      assert.deepEqual(filterAnalyticsEvent(view(input)), view(expected));
    });
  }

  it("aucun résultat ne contient « ? » ni « # »", () => {
    for (const [input] of cases) {
      const out = filterAnalyticsEvent(view(input));
      assert.ok(out && !/[?#]/.test(out.url), input);
    }
  });

  it("garde les autres champs de l'événement et ne modifie pas l'original", () => {
    const original = { type: "event" as const, url: `${SITE}/suivi?commande=AK-9`, name: "x" };
    const out = filterAnalyticsEvent(original);
    assert.deepEqual(out, { type: "event", url: `${SITE}/suivi`, name: "x" });
    assert.equal(original.url, `${SITE}/suivi?commande=AK-9`);
  });

  it("une adresse illisible n'est jamais envoyée", () => {
    assert.equal(filterAnalyticsEvent(view("http://")), null);
    assert.equal(filterAnalyticsEvent(view("http://[bad")), null);
  });
});

describe("branchement (composant, mise en page, paquet, proxy)", () => {
  it("le composant branche le filtre comme beforeSend", () => {
    const src = read("src/components/layout/site-analytics.tsx");
    assert.match(src, /"use client"/);
    assert.match(src, /from "@vercel\/analytics\/next"/);
    assert.match(src, /<Analytics beforeSend=\{filterAnalyticsEvent\} \/>/);
  });

  it("la mise en page affiche le composant, une seule fois, hors des fournisseurs", () => {
    const src = read("src/app/layout.tsx");
    assert.equal(src.match(/<SiteAnalytics \/>/g)?.length, 1);
    assert.ok(src.indexOf("</ZoneProvider>") < src.indexOf("<SiteAnalytics />"));
  });

  it("le paquet est déclaré, aucun autre outil de statistiques n'est présent", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.ok(pkg.dependencies["@vercel/analytics"]);
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    assert.doesNotMatch(all, /google-analytics|gtag|plausible|matomo|posthog|umami|hotjar|mixpanel|speed-insights/);
  });

  it("aucune nouvelle variable d'environnement n'est lue pour les statistiques", () => {
    for (const file of ["src/components/layout/site-analytics.tsx", "src/lib/analytics-filter.ts"]) {
      assert.doesNotMatch(read(file), /process\.env/);
    }
  });

  // Le « matcher » du proxy est une expression de chemin Next.js : on la lit dans le fichier
  // et on la rejoue en expression régulière.
  const matcher = (() => {
    const m = read("src/proxy.ts").match(/matcher:\s*\[\s*"([^"]+)"/);
    assert.ok(m, "matcher introuvable");
    return new RegExp(`^${m[1]}$`);
  })();

  it("le proxy (maintenance, connexion admin) ne s'applique pas à /_vercel/", () => {
    for (const p of ["/_vercel/insights/script.js", "/_vercel/insights/view", "/_vercel/speed-insights/script.js"]) {
      assert.ok(!matcher.test(p), `${p} ne doit pas passer par le proxy`);
    }
  });

  it("le proxy s'applique toujours aux pages de la boutique, à l'admin et aux API", () => {
    for (const p of ["/", "/catalogue", "/produit/beurre-de-karite-pur", "/commande", "/admin", "/admin/login", "/api/admin/upload", "/suivi"]) {
      assert.ok(matcher.test(p), `${p} doit passer par le proxy`);
    }
  });

  it("les exclusions déjà présentes sont conservées", () => {
    for (const p of ["/_next/static/x.js", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/logo/medallion.png", "/photos/a.jpg"]) {
      assert.ok(!matcher.test(p), `${p} doit rester exclu`);
    }
  });
});
