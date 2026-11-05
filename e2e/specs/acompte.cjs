// Règle des reçus d'un dossier de service : les règles de remboursement de l'acompte vont avec l'acompte PRÉVU
// (5 000 FCFA), pas avec « le premier paiement ». Cas limites par l'administration, reçus lus dans les courriels.
// Données fictives ; aucun vrai courriel (faux serveur d'envoi local).
const { BASE, OUT, check, sleep, finish, sql, logLines, launch, adminContext } = require("../lib/common.cjs");

const plusDays = (n) => new Date(Date.now() + 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const norm = (t) => (t || "").replace(/[  ]/g, " ");
const DEPOSIT_RULE = "L'acompte est remboursé seulement si AkaGest ne livre pas le service.";
const CONTRACT_RULE = "Conditions de remboursement : celles de votre contrat signé.";

// Chaque cas : montants payés dans l'ordre, et le type de reçu attendu pour chacun.
const CASES = [
  { key: "dessous", label: "4 999 puis 1 FCFA (juste en dessous, puis le complément)", pays: [4999, 1, 31666], expect: ["deposit", "deposit", "contract"] },
  { key: "exact", label: "exactement 5 000 FCFA", pays: [5000, 31666], expect: ["deposit", "contract"] },
  { key: "dessus", label: "5 001 FCFA (juste au-dessus)", pays: [5001, 100], expect: ["deposit", "contract"] },
  { key: "tranche", label: "une tranche entière (31 666) payée avant l'acompte", pays: [31666, 5000], expect: ["deposit", "contract"] },
];

(async () => {
  const browser = await launch();
  const admin = await adminContext(browser);
  const ap = admin.page;
  const errors = []; ap.on("pageerror", (e) => errors.push(String(e)));

  for (const c of CASES) {
    const email = `acompte.${c.key}@example.com`;
    await ap.goto(BASE + "/admin/services/nouveau", { waitUntil: "networkidle" });
    await ap.locator('input[name="merchantName"]').fill(`Dossier acompte ${c.key}`);
    await ap.locator('input[name="total"]').fill("100000");
    await ap.locator('input[name="clientName"]').fill("Client Acompte");
    await ap.locator('input[name="clientEmail"]').fill(email);
    await ap.getByText("3 tranches").click();
    for (let i = 0; i < 3; i++) await ap.locator('input[name="date"]').nth(i).fill(plusDays(30 * (i + 1)));
    await ap.getByRole("button", { name: "Créer le dossier et le lien privé" }).click();
    await ap.getByTestId("account-created").waitFor();
    const id = (await ap.getByTestId("account-created").innerText()).match(/SV-[A-Z0-9]{8}/)[0];
    await ap.goto(`${BASE}/admin/services/${id}`, { waitUntil: "networkidle" });
    for (const amount of c.pays) {
      const rec = ap.getByTestId("record-payment-form");
      await rec.locator('input[name="amount"]').fill(String(amount));
      await rec.locator('select[name="method"]').selectOption("especes");
      await rec.getByRole("button", { name: "Enregistrer le paiement" }).click();
      await sleep(1300);
    }
    const mails = logLines("emails.jsonl").filter((m) => JSON.stringify(m.to).includes(email) && /^Reçu de paiement/.test(m.subject || ""));
    const kinds = mails.map((m) => {
      const t = norm(m.text);
      const d = t.includes(DEPOSIT_RULE), k = t.includes(CONTRACT_RULE);
      return d && !k ? "deposit" : k && !d ? "contract" : "?";
    });
    check(`[acompte] ${c.label} : ${c.pays.length} reçus, types ${c.expect.join(" / ")}`, JSON.stringify(kinds) === JSON.stringify(c.expect), JSON.stringify({ kinds, n: mails.length }));
    if (c.key === "dessous") {
      check("[acompte] 4 999 FCFA : le reçu demande encore 1 FCFA d'acompte", /Prochaine échéance : Acompte — 1 FCFA/.test(norm(mails[0]?.text)), norm(mails[0]?.text).slice(0, 500));
    }
    if (c.key === "dessus") {
      check("[acompte] 5 001 FCFA : le reçu demande ensuite 31 665 FCFA (la tranche entamée d'1 FCFA)", /Tranche 1 — [^\n]* — 31 665 FCFA/.test(norm(mails[0]?.text)), norm(mails[0]?.text).slice(0, 500));
    }
    // Déjà payé : un reçu renvoyé plus tard dit la même chose que l'original.
    const first = sql(`select id from service_payments where account_id='${id}' order by confirmed_at limit 1`);
    await ap.goto(`${BASE}/admin/services/${id}`, { waitUntil: "networkidle" });
    const btn = ap.locator("li", { hasText: first }).getByRole("button", { name: /Renvoyer le reçu/ }).first();
    if ((await btn.count()) > 0) {
      const before = mails.length;
      await btn.click(); await sleep(1500);
      const after = logLines("emails.jsonl").filter((m) => JSON.stringify(m.to).includes(email) && /^Reçu de paiement/.test(m.subject || ""));
      check(`[acompte] ${c.key} : le reçu du premier paiement renvoyé après tous les autres dit exactement la même chose`, after.length === before + 1 && norm(after[after.length - 1].text) === norm(mails[0].text), `${after.length} / ${before}`);
    } else {
      check(`[acompte] ${c.key} : bouton « Renvoyer le reçu » du premier paiement trouvé`, false, "bouton absent");
    }
  }
  check("[acompte] aucune erreur de page pendant le parcours", errors.length === 0, errors.join("||"));
  await browser.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
