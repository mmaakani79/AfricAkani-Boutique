// Interrupteur des boutiques clientes (côté AfricAkani) : liste, statuts, point d'accès signé,
// suspension avec motif et journal, réactivation en un clic, conservation de 6 mois, hors ligne, mobile.
// Données fictives. La clé de vérification est lue dans la page pour vérifier la signature, jamais écrite
// dans un message.
const crypto = require("crypto");
const { BASE, OUT, SIZES, check, sleep, finish, sql, launch, noOverflow, adminContext } = require("../lib/common.cjs");

const norm = (t) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
const plusMonths = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};
// Même règle que src/lib/shop-status.ts (la boutique cliente la recopie) : signature HMAC-SHA256.
const verify = (answer, key, publicKey) => {
  if (!answer || answer.shop !== publicKey || typeof answer.ts !== "number") return false;
  const expected = crypto.createHmac("sha256", key).update(`v1.${publicKey}.${answer.status}.${answer.ts}`).digest("hex");
  return typeof answer.signature === "string" && answer.signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(answer.signature), Buffer.from(expected));
};

// Un dossier de paiement fictif en retard, pour vérifier l'indication sans effet automatique.
const ACCOUNT = "SV-E2EBQ001";
try {
  sql(`insert into service_accounts (id, merchant_name, total_amount, deposit_amount, installments_count, token_hash)
       values ('${ACCOUNT}', 'Marchand lié (TEST)', 60000, 5000, 2, '${crypto.randomBytes(32).toString("hex")}') on conflict (id) do nothing`);
  sql(`insert into service_installments (account_id, position, label, due_date) values ('${ACCOUNT}', 1, 'en retard', '2026-01-10'), ('${ACCOUNT}', 2, '', '2026-12-31') on conflict do nothing`);
} catch { /* déjà présent */ }

(async () => {
  const browser = await launch();
  const admin = await adminContext(browser);
  const ap = admin.page;
  const errors = [];
  ap.on("pageerror", (e) => errors.push(String(e)));

  // ===== 1. Liste vide, ajout =====
  await ap.goto(BASE + "/admin/boutiques", { waitUntil: "networkidle" });
  check("[admin] page « Boutiques clientes » : vide au départ, menu présent", (await ap.getByTestId("shops-empty").count()) === 1 && (await ap.getByTestId("nav-boutiques").count()) === 1);
  const guard = await fetch(BASE + "/admin/boutiques", { redirect: "manual" });
  check("[admin] sans connexion : redirection vers la connexion", guard.status >= 300 && guard.status < 400 && (guard.headers.get("location") || "").includes("/admin/login"), String(guard.status));

  await ap.getByTestId("create-shop-details").locator("summary").click();
  const form = ap.getByTestId("create-shop-form");
  await form.locator('input[name="name"]').fill("Boutique Djougou (TEST)");
  await form.locator('input[name="domain"]').fill("pas un domaine");
  await form.getByRole("button", { name: "Ajouter la boutique" }).click();
  await sleep(900);
  check("[ajout] un nom de domaine invalide est refusé, ce qui est tapé reste dans le formulaire", /domaine n'est pas valide/.test(await form.innerText()) && (await form.locator('input[name="name"]').inputValue()) === "Boutique Djougou (TEST)");
  await form.locator('input[name="domain"]').fill("https://Boutique-Djougou-Test.com/accueil");
  await form.locator('select[name="accountId"]').selectOption(ACCOUNT);
  await form.getByRole("button", { name: "Ajouter la boutique" }).click();
  await sleep(1300);
  await ap.goto(BASE + "/admin/boutiques", { waitUntil: "networkidle" });
  const rows = await ap.getByTestId("shop-row").count();
  const shopId = sql("select id from client_shops where name = 'Boutique Djougou (TEST)'");
  const publicKey = sql(`select public_key from client_shops where id = '${shopId}'`);
  check("[ajout] boutique ajoutée, domaine nettoyé, état « Actif »", rows === 1 && /^BQ-[A-Z0-9]{8}$/.test(shopId) && sql(`select domain||'|'||status from client_shops where id='${shopId}'`) === "boutique-djougou-test.com|actif" && /Actif/.test(await ap.getByTestId("shop-status").innerText()));
  check("[ajout] identifiant public aléatoire de 22 caractères", /^[A-Za-z0-9_-]{22}$/.test(publicKey));

  // ===== 2. Détail, clé de vérification =====
  await ap.goto(`${BASE}/admin/boutiques/${shopId}`, { waitUntil: "networkidle" });
  check("[détail] dossier de paiement lié affiché, avec le retard signalé SANS suspension automatique", /En retard/.test(await ap.getByTestId("linked-account").innerText()) && /jamais suspendue automatiquement/.test(await ap.getByTestId("linked-account").innerText()) && sql(`select status from client_shops where id='${shopId}'`) === "actif");
  check("[détail] la clé de vérification n'est pas dans la page tant qu'on ne la demande pas", (await ap.getByTestId("shop-key").count()) === 0);
  await ap.getByTestId("reveal-key").click();
  await ap.getByTestId("shop-key").waitFor();
  const key = await ap.getByTestId("shop-key").inputValue();
  const address = await ap.getByTestId("shop-address").inputValue();
  check("[détail] après clic : adresse du statut et clé (64 caractères hexadécimaux) affichées pour l'administrateur", address === `${BASE}/api/boutiques/${publicKey}/statut` && /^[0-9a-f]{64}$/.test(key));
  await ap.reload({ waitUntil: "networkidle" });
  check("[détail] la clé disparaît de la page au rechargement (rien n'est conservé dans le code de la page)", !(await ap.content()).includes(key));

  // ===== 3. Point d'accès signé =====
  const ask = async (k = publicKey) => { const r = await fetch(`${BASE}/api/boutiques/${k}/statut`); return { r, body: await r.json().catch(() => null) }; };
  let { r, body } = await ask();
  check("[statut] boutique active : réponse 200 « active », signée avec la clé de cette boutique, jamais en cache", r.status === 200 && body.status === "active" && verify(body, key, publicKey) && /no-store/.test(r.headers.get("cache-control") || ""), JSON.stringify({ s: r.status, st: body?.status }));
  check("[statut] la réponse ne contient que l'état (ni nom, ni motif, ni domaine)", JSON.stringify(Object.keys(body).sort()) === JSON.stringify(["shop", "signature", "status", "ts"]));
  check("[statut] une clé fausse ne valide pas la réponse ; la réponse modifiée non plus", !verify(body, "0".repeat(64), publicKey) && !verify({ ...body, status: "suspended" }, key, publicKey));
  const unknown = await ask("A".repeat(22));
  const malformed = await ask("n'importe-quoi");
  check("[statut] adresse inconnue ou mal formée : 404 identique, rien révélé", unknown.r.status === 404 && malformed.r.status === 404 && JSON.stringify(unknown.body) === JSON.stringify({ error: "not_found" }));
  const post = await fetch(`${BASE}/api/boutiques/${publicKey}/statut`, { method: "POST" });
  check("[statut] lecture seule : POST refusé", post.status === 405, String(post.status));

  // ===== 4. « En retard » : aucun effet pour le public =====
  await ap.getByTestId("mark-late").click(); await sleep(1500);
  ({ r, body } = await ask());
  check("[en retard] marquée « en retard » : le public ne voit rien (statut « late », la boutique reste ouverte)", /En retard/.test(await ap.getByTestId("detail-shop-status").innerText()) && body.status === "late" && verify(body, key, publicKey));
  await ap.getByTestId("mark-active").click(); await sleep(1500);
  check("[en retard] retour à « actif » en un clic", (await ask()).body.status === "active");

  // ===== 5. Suspension : motif obligatoire, confirmation, journal =====
  const sus = ap.getByTestId("suspend-form");
  await sus.locator('input[name="reason"]').fill("Deuxième tranche impayée (test)");
  await sus.getByRole("button", { name: "Suspendre la boutique" }).click(); await sleep(900);
  check("[suspension] sans case de confirmation : refusée, rien ne change", /Cochez la case/.test(await sus.innerText()) && sql(`select status from client_shops where id='${shopId}'`) === "actif" && (await sus.locator('input[name="reason"]').inputValue()) === "Deuxième tranche impayée (test)");
  await sus.locator('input[name="reason"]').evaluate((el) => { el.value = ""; el.removeAttribute("required"); });
  await sus.getByTestId("suspend-confirm").check();
  await sus.getByRole("button", { name: "Suspendre la boutique" }).click(); await sleep(900);
  check("[suspension] sans motif (même en contournant le formulaire du navigateur) : refusée par le serveur", /motif/i.test(await sus.innerText()) && sql(`select status from client_shops where id='${shopId}'`) === "actif");
  await sus.locator('input[name="reason"]').fill("Deuxième tranche impayée (test)");
  await sus.getByTestId("suspend-confirm").check();
  await sus.getByRole("button", { name: "Suspendre la boutique" }).click(); await sleep(1800);
  const expectedDelete = plusMonths(today(), 6);
  check("[suspension] suspendue : état, motif, date de fin de conservation (6 mois) enregistrés", sql(`select status||'|'||status_reason||'|'||delete_after from client_shops where id='${shopId}'`) === `suspendu|Deuxième tranche impayée (test)|${expectedDelete}`);
  await ap.reload({ waitUntil: "networkidle" });
  check("[suspension] la page indique le motif et la date de conservation ; le bouton « Réactiver » apparaît", /Deuxième tranche impayée/.test(await ap.getByTestId("suspended-note").innerText()) && (await ap.getByTestId("retention-note").innerText()).includes(expectedDelete) && (await ap.getByTestId("reactivate").count()) === 1);
  ({ r, body } = await ask());
  check("[suspension] le point d'accès annonce « suspended », signé : la boutique cliente peut s'y fier", body.status === "suspended" && verify(body, key, publicKey));
  check("[suspension] pas de suppression possible avant 6 mois (aucun bouton, aucune route)", (await ap.getByTestId("delete-form").count()) === 0);

  // ===== 6. Réactivation en un clic =====
  await ap.getByTestId("reactivate").click(); await sleep(1800);
  ({ r, body } = await ask());
  check("[réactivation] un clic : la boutique est de nouveau « active » ; la date de conservation est effacée", body.status === "active" && verify(body, key, publicKey) && sql(`select status||'|'||coalesce(delete_after::text,'-') from client_shops where id='${shopId}'`) === "actif|-");

  // ===== 7. Journal =====
  await ap.reload({ waitUntil: "networkidle" });
  const journal = norm(await ap.getByTestId("shop-journal").innerText());
  check("[journal] chaque changement est écrit : ajout, retard, retour, suspension (avec son motif), réactivation", /Actif → Suspendu : Deuxième tranche impayée \(test\)/.test(journal) && /Suspendu → Actif/.test(journal) && /Actif → En retard/.test(journal) && /En retard → Actif/.test(journal) && sql(`select count(*) from client_shop_events where shop_id='${shopId}'`) === "5", journal.slice(0, 300));
  const mustFail = (q) => { try { sql(q); return false; } catch { return true; } };
  check("[journal] la base refuse de modifier ou d'effacer le journal, et d'effacer une boutique", mustFail(`update client_shop_events set reason = 'x' where shop_id='${shopId}'`) && mustFail(`delete from client_shop_events where shop_id='${shopId}'`) && mustFail(`delete from client_shops where id='${shopId}'`));

  // ===== 8. Suppression : seulement après la conservation =====
  await ap.getByTestId("suspend-confirm").check();
  await ap.getByTestId("suspend-form").locator('input[name="reason"]').fill("Client parti (test)");
  await ap.getByRole("button", { name: "Suspendre la boutique" }).click(); await sleep(1800);
  await ap.reload({ waitUntil: "networkidle" });
  sql(`update client_shops set delete_after = '${plusMonths(today(), -1)}' where id='${shopId}'`); // on simule les 6 mois écoulés
  await ap.reload({ waitUntil: "networkidle" });
  check("[suppression] une fois les 6 mois écoulés, le formulaire de suppression apparaît", (await ap.getByTestId("delete-form").count()) === 1);
  const del = ap.getByTestId("delete-form");
  await del.locator('input[name="reason"]').fill("Contrat terminé (test)");
  await del.getByRole("button", { name: "Marquer comme supprimée" }).click(); await sleep(900);
  check("[suppression] sans confirmation : refusée", /Cochez la case/.test(await del.innerText()) && sql(`select status from client_shops where id='${shopId}'`) === "suspendu");
  await del.locator('input[name="confirm"]').check();
  await del.getByRole("button", { name: "Marquer comme supprimée" }).click(); await sleep(1800);
  ({ r, body } = await ask());
  await ap.reload({ waitUntil: "networkidle" });
  check("[suppression] marquée « supprimée » : le statut public devient « deleted », plus aucune action possible", body.status === "deleted" && verify(body, key, publicKey) && (await ap.getByTestId("deleted-note").count()) === 1 && (await ap.getByTestId("reactivate").count()) === 0 && (await ap.getByTestId("suspend-form").count()) === 0);

  // ===== 9. La maintenance de la boutique n'empêche pas les boutiques clientes de vérifier =====
  const shop2 = sql(`insert into client_shops (id, name, public_key) values ('BQ-E2EMAINT', 'Autre boutique (TEST)', 'Zm9vYmFyYmF6cXV4MTIzNA') returning id`).split("\n")[0];
  sql("insert into site_settings (id, maintenance_mode) values (1, true) on conflict (id) do update set maintenance_mode = true");
  await sleep(3500);
  const during = await fetch(`${BASE}/api/boutiques/Zm9vYmFyYmF6cXV4MTIzNA/statut`);
  const shopPage = await fetch(BASE + "/catalogue");
  sql("update site_settings set maintenance_mode = false where id = 1");
  await sleep(3500);
  check("[maintenance] boutique AfricAkani fermée (503) : l'adresse de statut répond quand même (200)", shopPage.status === 503 && during.status === 200 && shop2 === "BQ-E2EMAINT", `${shopPage.status} ${during.status}`);

  // ===== 10. Hors ligne =====
  { await ap.goto(`${BASE}/admin/boutiques/BQ-E2EMAINT`, { waitUntil: "networkidle" });
    await admin.ctx.setOffline(true);
    await ap.getByTestId("mark-late").click(); await sleep(1800);
    const msg = norm(await ap.locator("main").last().innerText());
    check("[hors ligne] « Marquer en retard » sans connexion : message clair, la page reste affichée, rien n'a changé", /n'a pas abouti/.test(msg) && (await ap.locator("h1").innerText()).includes("Autre boutique") && sql("select status from client_shops where id='BQ-E2EMAINT'") === "actif");
    await admin.ctx.setOffline(false); }

  // ===== 11. Mobile et ordinateur =====
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const a = await adminContext(browser, size);
    let ok = true, detail = "";
    for (const url of ["/admin/boutiques", `/admin/boutiques/${shopId}`, "/admin/boutiques/BQ-E2EMAINT"]) {
      await a.page.goto(BASE + url, { waitUntil: "networkidle" }); await sleep(250);
      if (!(await noOverflow(a.page))) { ok = false; detail += ` débordement ${url}`; }
    }
    check(`[admin ${w}px] liste et fiches des boutiques : aucun débordement horizontal`, ok, detail);
    if (size === "mobile320" || size === "desktop") {
      await a.page.goto(`${BASE}/admin/boutiques/BQ-E2EMAINT`, { waitUntil: "networkidle" });
      await a.page.screenshot({ path: `${OUT}/boutiques-detail-${w}.png`, fullPage: true });
    }
    await a.ctx.close();
  }
  check("[admin] aucune erreur de page pendant tout le parcours", errors.length === 0, errors.join("||"));

  await admin.ctx.close();
  await browser.close();
  finish();
})();
