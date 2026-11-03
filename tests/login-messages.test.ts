import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildLoginDiagnostic, classifyLoginError, loginRefusalMessage } from "@/lib/login-diagnostic";

const ROOT = path.resolve(import.meta.dirname, "..");
const PREVIEW = { VERCEL_ENV: "preview" };
const PRODUCTION = { VERCEL_ENV: "production" };

describe("messages de la page de connexion de l'administration", () => {
  it("mot de passe incorrect : en production, la phrase d'avant, rien de plus", () => {
    assert.equal(loginRefusalMessage({ resultat: "mot-de-passe-incorrect", env: PRODUCTION }), "Mot de passe incorrect.");
    assert.equal(loginRefusalMessage({ resultat: "mot-de-passe-incorrect", env: {} }), "Mot de passe incorrect.");
  });
  it("mot de passe incorrect : sur le Preview, on dit d'où vient le mot de passe attendu", () => {
    const m = loginRefusalMessage({ resultat: "mot-de-passe-incorrect", env: PREVIEW });
    assert.match(m, /^Mot de passe incorrect\./);
    assert.match(m, /environnement « Preview » de Vercel, pas celui de la production/);
  });
  it("variable absente, base de prévisualisation non utilisable, autre erreur : trois messages différents et clairs", () => {
    const absent = loginRefusalMessage({ resultat: "erreur-interne", cause: "admin-password-absente", env: PRODUCTION });
    const base = loginRefusalMessage({ resultat: "erreur-interne", cause: "garde-fou-base", env: PREVIEW });
    const autre = loginRefusalMessage({ resultat: "erreur-interne", cause: "autre", env: PREVIEW });
    assert.match(absent, /ADMIN_PASSWORD n'est pas configuré/);
    assert.match(base, /PREVIEW_DATABASE_URL/);
    assert.doesNotMatch(base, /ADMIN_PASSWORD/);
    assert.match(autre, /Erreur interne/);
    assert.equal(new Set([absent, base, autre]).size, 3);
  });
  it("une erreur de base de données n'est plus présentée comme « ADMIN_PASSWORD absent »", () => {
    const cause = classifyLoginError(new Error("Prévisualisation : PREVIEW_DATABASE_URL n'est pas définie."));
    assert.equal(cause, "garde-fou-base");
    assert.doesNotMatch(loginRefusalMessage({ resultat: "erreur-interne", cause, env: PREVIEW }), /ADMIN_PASSWORD n'est pas configuré/);
    assert.equal(classifyLoginError(new Error("ADMIN_PASSWORD is not set. Add it")), "admin-password-absente");
  });
  it("aucun message ne contient un mot de passe : le générateur ne reçoit jamais la saisie", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/login-diagnostic.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function loginRefusalMessage"));
    assert.doesNotMatch(fn, /candidate|password:/);
  });
  it("la page de connexion utilise ces messages", () => {
    const actions = fs.readFileSync(path.join(ROOT, "src/app/admin/actions.ts"), "utf8");
    assert.match(actions, /loginRefusalMessage\(\{ resultat: "mot-de-passe-incorrect"/);
    assert.match(actions, /loginRefusalMessage\(\{ resultat: "erreur-interne", cause: classifyLoginError\(err\)/);
  });
});

describe("journal de diagnostic du Preview (déjà en place) : seulement des longueurs et des oui/non", () => {
  it("ne contient jamais le mot de passe saisi ni celui attendu", () => {
    const d = buildLoginDiagnostic({
      env: { VERCEL_ENV: "preview", ADMIN_PASSWORD: "mot-de-passe-attendu-XYZ" },
      candidate: "saisie-secrete-ABC",
      resultat: "mot-de-passe-incorrect",
      usesStoredHash: false,
    });
    const text = JSON.stringify(d);
    assert.ok(!text.includes("saisie-secrete-ABC") && !text.includes("mot-de-passe-attendu-XYZ"));
    assert.equal(d.admin_password_definie, true);
    assert.equal(d.utilise_mot_de_passe_chiffre, false);
    assert.equal(d.saisie_longueur, "saisie-secrete-ABC".length);
  });
});
