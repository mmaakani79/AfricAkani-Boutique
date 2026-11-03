import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RETENTION_MONTHS,
  cleanDomain,
  decideShopOpen,
  deleteAfterDate,
  deriveShopKey,
  signShopStatus,
  toApiStatus,
  transitionError,
  verifyShopStatus,
  type ShopStatus,
} from "@/lib/shop-status";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const SECRET = "secret-de-test-pour-les-boutiques-0123456789";
const PUBLIC_KEY = "AbCdEfGhIjKlMnOpQrStUv";
const KEY = deriveShopKey(SECRET, PUBLIC_KEY);
const NOW = 1_800_000_000;

describe("changements d'état : à la main, avec motif", () => {
  const ok = (from: ShopStatus, to: ShopStatus, reason = "", deleteAfter: string | null = null, today = "2026-11-10") =>
    transitionError(from, to, { reason, deleteAfter, today });

  it("suspendre exige un motif", () => {
    assert.match(ok("actif", "suspendu", "") ?? "", /motif/);
    assert.match(ok("actif", "suspendu", "   ") ?? "", /motif/);
    assert.equal(ok("actif", "suspendu", "Deuxième tranche impayée"), null);
    assert.equal(ok("en_retard", "suspendu", "Impayé"), null);
  });
  it("réactiver : un clic, sans motif", () => {
    assert.equal(ok("suspendu", "actif"), null);
    assert.equal(ok("en_retard", "actif"), null);
  });
  it("« en retard » ne vient que d'une boutique active, et ne ferme rien", () => {
    assert.equal(ok("actif", "en_retard"), null);
    assert.ok(ok("suspendu", "en_retard"));
  });
  it("on ne passe pas deux fois au même état", () => {
    for (const s of ["actif", "en_retard", "suspendu"] as const) assert.match(ok(s, s, "x") ?? "", /déjà/);
  });
  it("suppression : seulement après suspension ET après 6 mois de conservation", () => {
    assert.match(ok("actif", "supprime", "x") ?? "", /Suspendez d'abord/);
    assert.match(ok("en_retard", "supprime", "x") ?? "", /Suspendez d'abord/);
    assert.match(ok("suspendu", "supprime", "x", "2027-05-10", "2027-05-09") ?? "", /à partir du 2027-05-10/);
    assert.match(ok("suspendu", "supprime", "", "2027-05-10", "2027-05-10") ?? "", /motif/);
    assert.equal(ok("suspendu", "supprime", "Client parti", "2027-05-10", "2027-05-10"), null);
    assert.equal(ok("suspendu", "supprime", "Client parti", "2027-05-10", "2028-01-01"), null);
  });
  it("une boutique supprimée ne change plus jamais", () => {
    for (const to of ["actif", "en_retard", "suspendu"] as const) assert.match(ok("supprime", to, "x") ?? "", /supprimée/);
  });
  it("6 mois de conservation", () => {
    assert.equal(RETENTION_MONTHS, 6);
    assert.equal(deleteAfterDate("2026-11-10"), "2027-05-10");
    assert.equal(deleteAfterDate("2026-08-31"), "2027-02-28");
  });
});

describe("noms de domaine", () => {
  it("nettoie et refuse", () => {
    assert.equal(cleanDomain("https://Boutique-Djougou.com/page"), "boutique-djougou.com");
    assert.equal(cleanDomain(""), "");
    for (const bad of ["pas un domaine", "http://", "a b.com", "exemple", "-x.com", "<script>.com"]) assert.equal(cleanDomain(bad), bad === "http://" ? "" : null, bad);
  });
});

describe("réponse signée du point d'accès", () => {
  const answer = signShopStatus(KEY, PUBLIC_KEY, "suspended", NOW);
  it("la bonne clé valide la réponse", () => {
    assert.equal(verifyShopStatus(answer, KEY, PUBLIC_KEY, NOW), true);
    assert.equal(answer.signature.length, 64);
  });
  it("chaque boutique a sa propre clé, dérivée du secret, jamais la même", () => {
    assert.notEqual(deriveShopKey(SECRET, "AutreBoutiqueAutreBou"), KEY);
    assert.notEqual(deriveShopKey("autre-secret", PUBLIC_KEY), KEY);
    assert.equal(deriveShopKey(SECRET, PUBLIC_KEY), KEY);
    assert.match(KEY, /^[0-9a-f]{64}$/);
  });
  it("falsification refusée : autre clé, autre boutique, état modifié, date modifiée, signature coupée", () => {
    assert.equal(verifyShopStatus(answer, deriveShopKey(SECRET, "AutreBoutiqueAutreBou"), PUBLIC_KEY, NOW), false);
    assert.equal(verifyShopStatus({ ...answer, shop: "AutreBoutiqueAutreBou" }, KEY, "AutreBoutiqueAutreBou", NOW), false);
    assert.equal(verifyShopStatus({ ...answer, status: "active" }, KEY, PUBLIC_KEY, NOW), false);
    assert.equal(verifyShopStatus({ ...answer, ts: NOW + 1 }, KEY, PUBLIC_KEY, NOW), false);
    assert.equal(verifyShopStatus({ ...answer, signature: answer.signature.slice(0, 20) }, KEY, PUBLIC_KEY, NOW), false);
    assert.equal(verifyShopStatus({ ...answer, signature: "zz".repeat(32) }, KEY, PUBLIC_KEY, NOW), false);
  });
  it("une réponse trop ancienne ou venue du futur est refusée", () => {
    assert.equal(verifyShopStatus(answer, KEY, PUBLIC_KEY, NOW + 601), false);
    assert.equal(verifyShopStatus(answer, KEY, PUBLIC_KEY, NOW - 601), false);
    assert.equal(verifyShopStatus(answer, KEY, PUBLIC_KEY, NOW + 599), true);
  });
  it("formes absurdes refusées sans erreur", () => {
    for (const bad of [null, undefined, "x", 12, [], {}, { shop: PUBLIC_KEY }, { ...answer, status: "ouvert" }, { ...answer, ts: "1" }]) {
      assert.equal(verifyShopStatus(bad, KEY, PUBLIC_KEY, NOW), false);
    }
  });
  it("états publics", () => {
    assert.deepEqual(
      (["actif", "en_retard", "suspendu", "supprime"] as const).map(toApiStatus),
      ["active", "late", "suspended", "deleted"]
    );
  });
});

describe("la boutique cliente ne se ferme QUE sur un ordre signé valide", () => {
  const signed = (status: "active" | "late" | "suspended" | "deleted", ts = NOW) => signShopStatus(KEY, PUBLIC_KEY, status, ts);
  it("suspendue ou supprimée (réponse signée et récente) : fermée", () => {
    assert.equal(decideShopOpen(signed("suspended"), KEY, PUBLIC_KEY, NOW), false);
    assert.equal(decideShopOpen(signed("deleted"), KEY, PUBLIC_KEY, NOW), false);
  });
  it("active ou en retard : ouverte (le retard n'a aucun effet pour le public)", () => {
    assert.equal(decideShopOpen(signed("active"), KEY, PUBLIC_KEY, NOW), true);
    assert.equal(decideShopOpen(signed("late"), KEY, PUBLIC_KEY, NOW), true);
  });
  it("AfricAkani injoignable ou réponse absente, vide, en erreur : la boutique reste OUVERTE", () => {
    for (const nothing of [null, undefined, "", {}, { error: "unavailable" }, { error: "not_found" }, "<html>502</html>", 503]) {
      assert.equal(decideShopOpen(nothing, KEY, PUBLIC_KEY, NOW), true, JSON.stringify(nothing));
    }
  });
  it("réponse falsifiée, d'une autre boutique, rejouée trop tard : la boutique reste ouverte (personne ne peut la fermer à tort)", () => {
    assert.equal(decideShopOpen({ ...signed("active"), status: "suspended" }, KEY, PUBLIC_KEY, NOW), true);
    assert.equal(decideShopOpen(signShopStatus(deriveShopKey(SECRET, "AutreBoutiqueAutreBou"), "AutreBoutiqueAutreBou", "suspended", NOW), KEY, PUBLIC_KEY, NOW), true);
    assert.equal(decideShopOpen(signed("suspended"), KEY, PUBLIC_KEY, NOW + 3600), true);
    assert.equal(decideShopOpen(signShopStatus("mauvaise-cle", PUBLIC_KEY, "suspended", NOW), KEY, PUBLIC_KEY, NOW), true);
  });
});

describe("branchement dans AfricAkani", () => {
  it("l'adresse de statut est en lecture seule, jamais en cache, sans motif ni nom, et ne dépend pas de la maintenance", () => {
    const route = read("src/app/api/boutiques/[key]/statut/route.ts");
    assert.match(route, /export async function GET/);
    assert.doesNotMatch(route, /export async function (POST|PUT|DELETE|PATCH)/);
    assert.match(route, /"Cache-Control": "no-store"/);
    assert.doesNotMatch(route, /statusReason|\.name\b|domain/);
    assert.match(route, /status: 404/);
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /pathname\.startsWith\("\/api\/boutiques\/"\)/);
    assert.ok(proxy.indexOf("/api/boutiques/") < proxy.indexOf("isShopClosed()"));
  });
  it("la clé vient du secret existant (aucune nouvelle variable) et ne figure dans aucune page par défaut", () => {
    assert.match(read("src/app/api/boutiques/[key]/statut/route.ts"), /process\.env\.ADMIN_SESSION_SECRET/);
    const actions = read("src/app/admin/(protected)/boutiques/actions.ts");
    assert.match(actions, /process\.env\.ADMIN_SESSION_SECRET/);
    assert.doesNotMatch(read("src/app/admin/(protected)/boutiques/[id]/page.tsx"), /deriveShopKey|ADMIN_SESSION_SECRET/);
    assert.doesNotMatch(read("src/app/admin/(protected)/boutiques/page.tsx"), /deriveShopKey|ADMIN_SESSION_SECRET/);
  });
  it("chaque action d'administration des boutiques vérifie la connexion d'abord ; rien ne suspend automatiquement", () => {
    const actions = read("src/app/admin/(protected)/boutiques/actions.ts");
    const fns = [...actions.matchAll(/export async function (\w+)\([\s\S]*?\n\}\n/g)];
    assert.ok(fns.length >= 6);
    for (const m of fns) assert.match(m[0], /await requireAdmin\(\);/, m[1]);
    for (const dir of ["src/lib", "src/app/api", "src/app/admin"]) {
      const walk = (d: string): string[] =>
        fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${d}/${e.name}`] : []
        );
      for (const f of walk(dir)) {
        if (f === "src/lib/client-shops-db.ts" || f.includes("/boutiques/")) continue;
        assert.doesNotMatch(read(f), /changeClientShopStatus/, `${f} ne doit pas changer l'état d'une boutique`);
      }
    }
  });
  it("le journal garde chaque changement avec son motif ; aucune suppression de boutique", () => {
    const db = read("src/lib/client-shops-db.ts");
    assert.match(db, /INSERT INTO client_shop_events/);
    assert.doesNotMatch(db, /DELETE FROM|TRUNCATE|DROP /i);
  });
});
