// E-mails à la signature d'un contrat : contenu, un seul envoi, échec enregistré, renvoi.
// Sans base de données ni fournisseur d'e-mail : tout est simulé. Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CONTRACT_EMAIL_TARGETS,
  contractEmailStatus,
  contractHasEmailFailure,
  deliverContractEmails,
  safeEmailError,
  type ContractEmailSenders,
  type ContractEmailStore,
} from "@/lib/contract-email-delivery";
import {
  buildAdminContractEmail,
  buildClientContractEmail,
  contractPdfFilename,
  formatContractDate,
} from "@/lib/contract-email-content";
import { isValidContractId } from "@/lib/contract-types";
import type { ContractEmailState, ContractEmailTarget, SignedContract } from "@/lib/contracts-db";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const blank = (): ContractEmailState => ({ sentAt: null, error: null, claimedAt: null });

function contract(overrides: Partial<SignedContract> = {}): SignedContract {
  return {
    id: "CT-MGX4F2K9-7QHD",
    createdAt: "2026-10-13T13:32:00.000Z",
    clientName: "Awa Koné",
    clientEmail: "awa@example.com",
    clientPhone: "+229 97 00 00 00",
    companyName: "Koné & Fils",
    services: ["Site web", "Boutique en ligne"],
    projectDescription: "Un site pour mon atelier.",
    budget: "500 000 FCFA",
    timeline: "6 semaines",
    notes: "",
    contractTextSnapshot: "Texte du contrat",
    signatureDataUrl: "data:image/png;base64,AAAA",
    emails: { admin: blank(), client: blank() },
    ...overrides,
  };
}

/** A tiny in-memory stand-in for the database, with the same atomic claim rule. */
function fakeStore(initial: SignedContract = contract()) {
  const row = structuredClone(initial);
  const log: string[] = [];
  const store: ContractEmailStore = {
    async getContract() {
      return structuredClone(row);
    },
    async claim(_id, target, force) {
      const s = row.emails[target];
      if (s.claimedAt !== null) return false; // someone is sending right now
      if (!force && s.sentAt !== null) return false; // already sent
      s.claimedAt = new Date().toISOString(); // synchronous: atomic, like the SQL UPDATE
      log.push(`claim:${target}${force ? ":force" : ""}`);
      return true;
    },
    async markSent(_id, target) {
      Object.assign(row.emails[target], { sentAt: new Date().toISOString(), error: null, claimedAt: null });
      log.push(`sent:${target}`);
    },
    async markFailed(_id, target, message) {
      Object.assign(row.emails[target], { error: message, claimedAt: null });
      log.push(`failed:${target}`);
    },
  };
  return { row, log, store };
}

function fakeSenders(opts: { failAdmin?: string; failClient?: string; delayMs?: number } = {}) {
  const sent: { target: ContractEmailTarget; to: string }[] = [];
  const wait = () => new Promise((r) => setTimeout(r, opts.delayMs ?? 0));
  const senders: ContractEmailSenders = {
    async admin(c) {
      await wait();
      if (opts.failAdmin) throw new Error(opts.failAdmin);
      sent.push({ target: "admin", to: "admin" });
      void c;
    },
    async client(c) {
      await wait();
      if (opts.failClient) throw new Error(opts.failClient);
      sent.push({ target: "client", to: c.clientEmail });
    },
  };
  return { sent, senders };
}

describe("contenu de l'e-mail à l'administrateur", () => {
  const mail = buildAdminContractEmail(contract(), "https://www.africakani.com");
  const text = mail.lines.join("\n");

  it("nom du client, date, référence du contrat et lien vers l'admin", () => {
    assert.ok(text.includes("Awa Koné"));
    assert.ok(text.includes("CT-MGX4F2K9-7QHD"));
    assert.ok(text.includes("13 octobre 2026 à 14:32"), text); // 13:32 UTC = 14:32 à Cotonou
    assert.ok(text.includes("https://www.africakani.com/admin/contrats"));
    assert.ok(mail.subject.includes("CT-MGX4F2K9-7QHD") && mail.subject.includes("Awa Koné"));
  });

  it("le contrat n'est pas joint et le texte le dit", () => {
    assert.ok(/n'est pas joint/.test(text));
    assert.ok(!/base64|data:image/.test(text), "la signature ne doit jamais apparaître dans le message");
  });
});

describe("contenu de l'e-mail au client", () => {
  const c = contract();
  const mail = buildClientContractEmail(c);
  const text = mail.lines.join("\n");

  it("confirmation personnalisée, référence, date, et mention de la copie PDF jointe", () => {
    assert.ok(text.startsWith("Bonjour Awa,"));
    assert.ok(text.includes(c.id) && text.includes("13 octobre 2026 à 14:32"));
    assert.ok(text.includes("copie de votre contrat au format PDF"));
    assert.ok(text.includes(contractPdfFilename(c)));
    assert.equal(contractPdfFilename(c), "contrat-CT-MGX4F2K9-7QHD.pdf");
    assert.ok(/répondez simplement à cet e-mail/.test(text));
  });

  it("le nom du client ne casse rien : espaces, nom vide", () => {
    assert.ok(buildClientContractEmail(contract({ clientName: "  Awa   Koné " })).lines[0].startsWith("Bonjour Awa,"));
    assert.equal(buildClientContractEmail(contract({ clientName: "" })).lines[0], "Bonjour,");
  });

  it("la date est celle de Cotonou, quelle que soit l'heure du serveur", () => {
    assert.equal(formatContractDate("2026-10-13T23:30:00.000Z"), "14 octobre 2026 à 00:30");
  });
});

describe("références de contrat", () => {
  it("accepte l'ancien format et le nouveau, refuse tout le reste", () => {
    for (const ok of ["CT-MGX4F2K9", "CT-MGX4F2K9-7QHD"]) assert.ok(isValidContractId(ok), ok);
    for (const bad of ["", "ct-abc", "CT-", "CT-AB", "CT-ABCD/../x", 'CT-ABCD"', "CT-ABCD\nBcc: x", 42, null, undefined])
      assert.ok(!isValidContractId(bad), String(bad));
  });
});

describe("envoi : un seul envoi, jamais deux", () => {
  it("à la signature : un e-mail à l'administrateur et un au client, chacun une fois", async () => {
    const { store, row } = fakeStore();
    const { senders, sent } = fakeSenders();
    const result = await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders });
    assert.deepEqual(result, { admin: "sent", client: "sent" });
    assert.deepEqual(sent.map((s) => s.target).sort(), ["admin", "client"]);
    assert.equal(sent.find((s) => s.target === "client")!.to, "awa@example.com");
    assert.ok(row.emails.admin.sentAt && row.emails.client.sentAt && !row.emails.admin.error);
  });

  it("double clic / deux serveurs en même temps : un seul envoi par e-mail", async () => {
    const { store, row } = fakeStore();
    const { senders, sent } = fakeSenders({ delayMs: 20 });
    const [a, b] = await Promise.all([
      deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders }),
      deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders }),
    ]);
    assert.equal(sent.length, 2, JSON.stringify({ a, b, sent }));
    assert.deepEqual([a.admin, b.admin].sort(), ["sent", "skipped"]);
    assert.deepEqual([a.client, b.client].sort(), ["sent", "skipped"]);
  });

  it("rechargement de la page après envoi : rien n'est renvoyé", async () => {
    const { store, row } = fakeStore();
    const { senders, sent } = fakeSenders();
    await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders });
    const again = await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders });
    assert.deepEqual(again, { admin: "skipped", client: "skipped" });
    assert.equal(sent.length, 2);
  });
});

describe("échec d'envoi : le contrat reste, l'échec est noté, on peut renvoyer", () => {
  it("l'échec est enregistré avec sa raison, sans lever d'erreur", async () => {
    const { store, row } = fakeStore();
    const { senders, sent } = fakeSenders({ failAdmin: "Resend [validation_error 403] : domaine non vérifié" });
    const result = await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders });
    assert.deepEqual(result, { admin: "failed", client: "sent" }); // l'un n'empêche pas l'autre
    assert.equal(sent.length, 1);
    assert.match(row.emails.admin.error!, /domaine non vérifié/);
    assert.equal(row.emails.admin.sentAt, null);
    assert.equal(row.emails.admin.claimedAt, null, "le verrou est relâché pour pouvoir renvoyer");
    assert.equal(contractEmailStatus(row.emails.admin).kind, "failed");
    assert.equal(contractHasEmailFailure(row), true);
  });

  it("renvoi après échec : part une fois, l'erreur disparaît", async () => {
    const { store, row } = fakeStore();
    await deliverContractEmails({ contractId: row.id, targets: ["admin"], store, senders: fakeSenders({ failAdmin: "panne" }).senders });
    const retry = fakeSenders();
    const result = await deliverContractEmails({ contractId: row.id, targets: ["admin"], force: true, store, senders: retry.senders });
    assert.equal(result.admin, "sent");
    assert.equal(retry.sent.length, 1);
    assert.equal(row.emails.admin.error, null);
    assert.equal(contractEmailStatus(row.emails.admin).kind, "sent");
    assert.equal(contractHasEmailFailure(row), false);
  });

  it("renvoyer un e-mail déjà envoyé n'est possible que sur demande explicite (force)", async () => {
    const { store, row } = fakeStore();
    const first = fakeSenders();
    await deliverContractEmails({ contractId: row.id, targets: ["client"], store, senders: first.senders });
    const noForce = await deliverContractEmails({ contractId: row.id, targets: ["client"], store, senders: first.senders });
    assert.equal(noForce.client, "skipped");
    const forced = await deliverContractEmails({ contractId: row.id, targets: ["client"], force: true, store, senders: first.senders });
    assert.equal(forced.client, "sent");
    assert.equal(first.sent.length, 2);
  });

  it("le fournisseur ne répond pas : l'attente est bornée et le message prévient d'un envoi possible", async () => {
    const { store, row } = fakeStore();
    const senders: ContractEmailSenders = { admin: () => new Promise(() => {}), client: async () => {} };
    const started = Date.now();
    const result = await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders, timeoutMs: 50 });
    assert.ok(Date.now() - started < 1500);
    assert.equal(result.admin, "failed");
    assert.match(row.emails.admin.error!, /peut-être abouti/);
    assert.equal(result.client, "sent");
  });

  it("la base inaccessible au moment de réclamer l'envoi : rien n'est envoyé, rien ne plante", async () => {
    const { store, row } = fakeStore();
    store.claim = async () => {
      throw new Error("connexion refusée");
    };
    const { senders, sent } = fakeSenders();
    const result = await deliverContractEmails({ contractId: row.id, targets: CONTRACT_EMAIL_TARGETS, store, senders });
    assert.deepEqual(result, { admin: "failed", client: "failed" });
    assert.equal(sent.length, 0);
  });

  it("impossible d'enregistrer l'échec : on ne plante quand même pas", async () => {
    const { store, row } = fakeStore();
    store.markFailed = async () => {
      throw new Error("base coupée");
    };
    const result = await deliverContractEmails({ contractId: row.id, targets: ["admin"], store, senders: fakeSenders({ failAdmin: "x" }).senders });
    assert.equal(result.admin, "failed");
  });

  it("aucune clé secrète dans le message d'échec conservé", () => {
    const msg = safeEmailError(new Error("Resend [401] : API key re_AbCdEf1234567890_xyz invalide"));
    assert.ok(!msg.includes("re_AbCdEf1234567890_xyz") && msg.includes("[clé masquée]"));
    assert.ok(safeEmailError(new Error("x".repeat(1000))).length <= 300);
  });
});

describe("ce que voit l'administrateur", () => {
  const now = Date.parse("2026-10-13T14:00:00.000Z");
  it("envoyé / échec / en cours / non envoyé", () => {
    assert.deepEqual(contractEmailStatus({ sentAt: "2026-10-13T13:00:00.000Z", error: null, claimedAt: null }, now), { kind: "sent", at: "2026-10-13T13:00:00.000Z" });
    assert.deepEqual(contractEmailStatus({ sentAt: null, error: "panne", claimedAt: null }, now), { kind: "failed", error: "panne" });
    assert.deepEqual(contractEmailStatus({ sentAt: null, error: null, claimedAt: "2026-10-13T13:59:30.000Z" }, now), { kind: "sending" });
    assert.deepEqual(contractEmailStatus(blank(), now), { kind: "not_sent" });
  });

  it("un envoi « en cours » depuis plus de 2 minutes n'est plus considéré en cours (requête perdue)", () => {
    assert.equal(contractEmailStatus({ sentAt: null, error: null, claimedAt: "2026-10-13T13:50:00.000Z" }, now).kind, "not_sent");
  });

  it("un ancien contrat (avant cette fonction) apparaît « non envoyé » sans fausse alerte d'échec", () => {
    assert.equal(contractHasEmailFailure(contract(), now), false);
  });
});

describe("adresse de notification et expéditeur : rien d'écrit en dur", () => {
  const sources = ["src/lib/contract-email-content.ts", "src/lib/contract-email-delivery.ts", "src/lib/contract-notifications.ts", "src/app/contrat/actions.ts"];

  it("aucune adresse e-mail en dur dans le code des e-mails de contrat", () => {
    for (const file of sources) {
      const code = read(file).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const emails = code.match(/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g) ?? [];
      assert.deepEqual(emails, [], `${file} : ${emails.join(", ")}`);
    }
  });

  it("les deux fonctions d'envoi de contrat (dans email.ts) ne contiennent aucune adresse en dur", () => {
    const email = read("src/lib/email.ts");
    const part = email.slice(email.indexOf("export async function sendContractAdminEmail"), email.indexOf("export async function sendCustomerOrderCancelled"));
    assert.deepEqual(part.match(/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g) ?? [], []);
  });

  it("l'administrateur et le « répondre à » du client viennent de la configuration (variable d'environnement)", () => {
    const email = read("src/lib/email.ts");
    const admin = email.slice(email.indexOf("export async function sendContractAdminEmail"), email.indexOf("export async function sendContractClientEmail"));
    const client = email.slice(email.indexOf("export async function sendContractClientEmail"), email.indexOf("export async function sendCustomerOrderCancelled"));
    assert.match(admin, /to: getAdminNotifyEmail\(\)/);
    assert.match(client, /replyTo: getAdminNotifyEmail\(\)/);
    assert.match(read("src/lib/order-config.ts"), /process\.env\.ADMIN_NOTIFY_EMAIL/);
  });

  it("le client reçoit le contrat en pièce jointe PDF, l'administrateur non ; même expéditeur que les commandes", () => {
    const email = read("src/lib/email.ts");
    const admin = email.slice(email.indexOf("export async function sendContractAdminEmail"), email.indexOf("export async function sendContractClientEmail"));
    const client = email.slice(email.indexOf("export async function sendContractClientEmail"), email.indexOf("export async function sendCustomerOrderCancelled"));
    assert.ok(!/attachments/.test(admin));
    assert.match(client, /attachments: \[\{ filename: contractPdfFilename\(contract\), content: pdf \}\]/);
    assert.match(admin, /from: getFrom\(\)/);
    assert.match(client, /from: getFrom\(\)/);
  });
});

describe("la signature n'est jamais bloquée par les e-mails", () => {
  it("l'action enregistre d'abord, puis envoie ; une panne d'envoi est rattrapée", () => {
    const action = read("src/app/contrat/actions.ts");
    assert.ok(action.indexOf("createSignedContract(") < action.indexOf("notifyContractSigned("));
    assert.match(action, /try \{\s*clientCopySent = \(await notifyContractSigned\(contract\.id\)\)\.client === "sent";\s*\} catch/);
    assert.match(action, /return \{ ok: true, contractId: contract\.id, clientCopySent \}/);
  });

  it("seule la requête qui crée le contrat envoie automatiquement (un doublon n'envoie rien de nouveau)", () => {
    const action = read("src/app/contrat/actions.ts");
    assert.match(action, /if \(!created\) \{/);
    assert.match(action, /resendContractEmails\(contract\.id, neverAttempted, false\)/);
  });

  it("migration additive uniquement : colonnes ajoutées, rien de supprimé", () => {
    const db = read("src/lib/db.ts");
    const block = db.slice(db.indexOf("-- E-mails sent when a contract is signed"), db.indexOf("`;", db.indexOf("-- E-mails sent when a contract is signed")));
    assert.equal((block.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, 6);
    assert.ok(!/DROP|DELETE|TRUNCATE|ALTER COLUMN|NOT NULL/i.test(block.replace(/^--.*$/gm, "")), "aucune opération destructive ni contrainte bloquante");
  });
});

describe("accès aux contrats : réservés à l'administrateur", () => {
  it("le téléchargement du PDF exige la connexion admin, avant de lire la base", () => {
    const route = read("src/app/api/admin/contrats/[id]/pdf/route.ts");
    assert.ok(route.indexOf("await isAdminAuthed()") < route.indexOf("await getSignedContractById"));
    assert.match(route, /status: 401/);
  });

  it("les actions d'administration (suppression, renvoi, texte) vérifient la connexion admin", () => {
    const actions = read("src/app/admin/(protected)/contrats/actions.ts");
    assert.equal((actions.match(/await requireAdmin\(\);/g) ?? []).length, 3);
  });

  it("aucune page publique ni route publique ne lit les contrats signés", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(entry.name) && /getSignedContractById|getAllSignedContracts/.test(read(rel))) offenders.push(rel);
      }
    };
    walk("src");
    const allowed = [
      "src/lib/contracts-db.ts",
      "src/lib/contract-notifications.ts", // envoi des e-mails (jamais servi tel quel)
      "src/app/admin/(protected)/contrats/page.tsx",
      "src/app/admin/(protected)/contrats/actions.ts",
      "src/app/api/admin/contrats/[id]/pdf/route.ts",
    ];
    assert.deepEqual(offenders.filter((f) => !allowed.includes(f)), []);
  });
});
