import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("paiements de services : base de données (ajouts seulement, rien ne s'efface)", () => {
  const db = read("src/lib/db.ts");
  const services = db.slice(db.indexOf("Payment files for the services"));

  it("uniquement de nouvelles tables, aucune modification des tables existantes", () => {
    const tables = [...services.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    assert.deepEqual(tables, [
      "service_accounts",
      "service_installments",
      "service_payments",
      "service_adjustments",
      "service_events",
      "client_shops",
      "client_shop_events",
    ]);
    assert.doesNotMatch(services, /ALTER TABLE (products|orders|order_items|signed_contracts|categories)/);
    assert.doesNotMatch(services, /DROP (TABLE|COLUMN)|TRUNCATE|DELETE FROM/i);
  });

  it("des garde-fous refusent toute suppression, et toute modification des historiques", () => {
    for (const t of ["service_accounts", "service_installments", "service_payments"]) {
      assert.match(services, new RegExp(`BEFORE DELETE ON ${t}`), t);
    }
    assert.match(services, /BEFORE DELETE ON client_shops/);
    for (const t of ["service_adjustments", "service_events", "client_shop_events"]) {
      assert.match(services, new RegExp(`BEFORE UPDATE OR DELETE ON ${t}`), t);
    }
  });

  it("un même identifiant de transaction Mobile Money ne peut pas être compté deux fois", () => {
    assert.match(services, /CREATE UNIQUE INDEX IF NOT EXISTS service_payments_txid_unique/);
  });

  it("le lien secret n'est jamais stocké en clair", () => {
    assert.match(services, /token_hash TEXT NOT NULL UNIQUE/);
    assert.doesNotMatch(services, /\btoken TEXT\b/);
  });

  it("aucun code du module ne supprime une ligne de service", () => {
    assert.doesNotMatch(read("src/lib/service-accounts-db.ts"), /DELETE FROM|TRUNCATE|DROP /i);
  });
});

describe("page privée du client", () => {
  const page = read("src/app/paiement-service/[token]/page.tsx");
  it("jamais indexée, jamais en cache, sans référent, introuvable si le lien est faux", () => {
    assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
    assert.match(page, /referrer: "no-referrer"/);
    assert.match(page, /dynamic = "force-dynamic"/);
    assert.match(page, /if \(!full\) notFound\(\)/);
  });
  it("renvoie vers le contrat signé en lecture seule (PDF), par le lien secret seulement", () => {
    assert.match(page, /\/paiement-service\/\$\{token\}\/contrat/);
    const route = read("src/app/paiement-service/[token]/contrat/route.ts");
    assert.match(route, /getServiceAccountByToken/);
    assert.match(route, /"Cache-Control": "no-store"/);
    assert.match(route, /X-Robots-Tag/);
    assert.doesNotMatch(route, /export async function (POST|PUT|DELETE|PATCH)/);
  });
  it("en-tête, bandeau et pied de page du site masqués sur cette route ; aucune statistique ; pas d'indexation", () => {
    assert.match(read("src/components/layout/site-chrome.tsx"), /\/paiement-service/);
    const layout = read("src/app/layout.tsx");
    assert.equal(layout.match(/<SiteChrome>/g)?.length, 2);
    assert.match(read("src/app/robots.ts"), /"\/paiement-service"/);
    assert.doesNotMatch(read("src/app/sitemap.ts"), /paiement-service/);
    assert.match(read("src/lib/analytics-filter.ts"), /"\/paiement-service"/);
  });
  it("la page reste accessible quand la boutique est fermée pour maintenance", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /pathname\.startsWith\("\/paiement-service\/"\)/);
    assert.ok(proxy.indexOf("/paiement-service/") < proxy.indexOf("isShopClosed()"));
  });
  it("le lien secret est lié à l'action (jamais dans le formulaire) et vérifié à chaque envoi", () => {
    const action = read("src/app/paiement-service/[token]/actions.ts");
    assert.match(action, /token: string,\s*_previous/);
    assert.match(action, /getServiceAccountByToken\(token\)/);
    assert.match(action, /parseMobileMoneySubmission/);
    assert.match(page, /submitServicePaymentAction\.bind\(null, token\)/);
  });
});

describe("administration : tout est protégé et séparé", () => {
  const actions = read("src/app/admin/(protected)/services/actions.ts");
  it("chaque action d'administration commence par la vérification de connexion", () => {
    const fns = [...actions.matchAll(/export async function (\w+)\([\s\S]*?\n\}\n/g)];
    assert.ok(fns.length >= 8);
    for (const m of fns) assert.match(m[0], /await requireAdmin\(\);/, m[1]);
  });
  it("aucune suppression n'est proposée : ni action, ni bouton", () => {
    assert.doesNotMatch(actions, /delete|supprim/i);
    assert.doesNotMatch(read("src/components/admin/service-controls.tsx"), /Supprimer|Trash/);
  });
  it("les statistiques de la boutique (commandes) ne lisent aucune table de services", () => {
    assert.doesNotMatch(read("src/lib/orders-db.ts"), /service_/);
    assert.doesNotMatch(read("src/lib/products-db.ts"), /service_/);
  });
  it("le courriel de notification ne contient jamais le lien secret", () => {
    const email = read("src/lib/email.ts");
    const fn = email.slice(email.indexOf("sendAdminServicePaymentSubmitted"), email.indexOf("export async function sendCustomerOrderConfirmation"));
    assert.doesNotMatch(fn, /token|paiement-service/i);
    assert.match(fn, /\/admin\/services\//);
  });
  it("aucune nouvelle variable d'environnement dans le module", () => {
    for (const f of [
      "src/lib/service-account-math.ts",
      "src/lib/service-validation.ts",
      "src/lib/service-token.ts",
      "src/lib/service-accounts-db.ts",
      "src/app/paiement-service/[token]/page.tsx",
      "src/app/paiement-service/[token]/actions.ts",
    ]) {
      assert.doesNotMatch(read(f), /process\.env/, f);
    }
    assert.match(read("src/app/admin/(protected)/services/actions.ts"), /process\.env\.NEXT_PUBLIC_SITE_URL/);
  });
});
