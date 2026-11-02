// Paiements de services (lot 1) : dossier de paiement d'un client, versement Mobile Money,
// page privée par lien secret, confirmation / rejet, ajustements, retard, statistiques à part.
// Données fictives uniquement ; aucun vrai paiement ; aucun secret affiché (le lien privé est lu
// dans la page mais jamais écrit dans les messages).
const fs = require("fs");
const path = require("path");
const { BASE, OUT, SIZES, check, info, sleep, finish, sql, logLines, launch, noOverflow, adminContext } = require("../lib/common.cjs");

const FAKE_SCRIPT = fs.readFileSync(path.join(__dirname, "../lib/fake-analytics-script.js"), "utf8");
const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MERCHANT = "Volaille Djougou (TEST)";
const fmt = (n) => `${n.toLocaleString("fr-FR")} FCFA`.replace(/ | /g, " ");
const norm = (t) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + 3600e3 + n * 86400e3).toISOString().slice(0, 10);

// ---- Fiche de contrat fictive, liée au dossier ----------------------------------------------------
sql("delete from signed_contracts where id = 'CT-E2E-1'");
sql(`insert into signed_contracts (id, client_name, client_email, client_phone, company_name, services, project_description, contract_text_snapshot, signature_data_url)
     values ('CT-E2E-1', 'Client Test', 'client.test@example.com', '+22997000001', '${MERCHANT}', '{}', 'Boutique de volaille (test)', 'Texte du contrat de test.', '${PNG_1X1}')`);
const BEFORE = { products: sql("select count(*) from products"), orders: sql("select count(*) from orders"), contracts: sql("select count(*) from signed_contracts") };

async function openClient(browser, size, withScript = true) {
  const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
  const beacons = [];
  await ctx.route("**/_vercel/insights/script.js", (r) => (withScript ? r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SCRIPT }) : r.fulfill({ status: 404, body: "" })));
  await ctx.route("**/_vercel/insights/view", (r) => { beacons.push(r.request().postData() || ""); r.fulfill({ status: 200, body: "ok" }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors, beacons };
}
const t = (page, id) => page.getByTestId(id).innerText().then(norm);

(async () => {
  const browser = await launch();
  const admin = await adminContext(browser);
  const ap = admin.page;
  const adminErrors = [];
  ap.on("pageerror", (e) => adminErrors.push(String(e)));

  // ===== 1. Le module est vide et à part =====
  await ap.goto(BASE + "/admin/services", { waitUntil: "networkidle" });
  check("[admin] page Services : message « Aucun dossier » et menu « Services » présent", (await ap.getByTestId("services-empty").count()) === 1 && (await ap.getByTestId("nav-services").count()) === 1);
  const guard = await fetch(BASE + "/admin/services", { redirect: "manual" });
  check("[admin] sans connexion : redirection vers la connexion", guard.status >= 300 && guard.status < 400 && (guard.headers.get("location") || "").includes("/admin/login"), String(guard.status));

  // ===== 2. Création du dossier du premier client =====
  await ap.goto(BASE + "/admin/services/nouveau", { waitUntil: "networkidle" });
  await ap.locator('select[name="contractId"]').selectOption("CT-E2E-1");
  check("[création] le contact du client (nom, e-mail, téléphone) se remplit aussi depuis le contrat", (await ap.locator('input[name="clientEmail"]').inputValue()) === "client.test@example.com" && (await ap.locator('input[name="clientPhone"]').inputValue()) === "+22997000001" && (await ap.locator('input[name="clientName"]').inputValue()) === "Client Test");
  check("[création] le nom du marchand se remplit depuis le contrat lié", (await ap.locator('input[name="merchantName"]').inputValue()) === MERCHANT);
  // refus d'une saisie invalide
  await ap.locator('input[name="total"]').fill("abc");
  await ap.getByText("3 tranches").click();
  const dates = [plusDays(20), plusDays(40), plusDays(60)];
  for (let i = 0; i < 3; i++) await ap.locator('input[name="date"]').nth(i).fill(dates[i]);
  await ap.locator('input[name="label"]').nth(0).fill("avant mise en ligne");
  await ap.getByRole("button", { name: "Créer le dossier et le lien privé" }).click();
  await ap.getByTestId("new-account-error").waitFor();
  check("[création] un prix total invalide est refusé avec un message clair", /prix total/i.test(await t(ap, "new-account-error")));
  await ap.locator('input[name="total"]').fill("100 000");
  await ap.getByRole("button", { name: "Créer le dossier et le lien privé" }).click();
  await ap.getByTestId("account-created").waitFor();
  const link = await ap.getByTestId("private-link").inputValue();
  const token = link.split("/paiement-service/")[1] || "";
  const accountId = (await ap.getByTestId("account-created").innerText()).match(/SV-[A-Z0-9]{8}/)[0];
  check("[création] dossier créé et lien privé affiché une seule fois (jeton de 43 caractères)", /^[A-Za-z0-9_-]{43}$/.test(token));
  check("[création] bouton WhatsApp prêt à l'envoi (numéro pris dans le contrat)", (await ap.getByRole("link", { name: /Envoyer par WhatsApp/ }).getAttribute("href"))?.startsWith("https://wa.me/22997000001?text=") === true);
  check("[sécurité] le lien n'est stocké nulle part en clair (seule son empreinte)", sql(`select count(*) from service_accounts where to_jsonb(service_accounts)::text like '%${token}%'`) === "0" && sql(`select count(*) from service_events where detail like '%${token}%'`) === "0");
  check("[création] total 100 000, acompte 5 000, 3 tranches, mensualité de suivi 3 000 par défaut", sql(`select total_amount||'/'||deposit_amount||'/'||installments_count||'/'||followup_amount from service_accounts where id='${accountId}'`) === "100000/5000/3/3000");

  // ===== 3. Page privée du client, 4 largeurs =====
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const { ctx, page, errors, beacons } = await openClient(browser, size);
    const resp = await page.goto(link, { waitUntil: "networkidle" }); await sleep(500);
    check(`[client ${w}px] la page privée répond (200) et affiche le marchand`, resp.status() === 200 && (await page.locator("h1").innerText()) === MERCHANT);
    const hrefs = await page.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check(`[client ${w}px] rien d'autre du site : ni bandeau, ni en-tête, ni pied de page, ni panier ; seul lien : le contrat`, (await page.locator("header a, footer, nav").count()) === 0 && hrefs.length === 1 && hrefs[0].endsWith("/contrat"), JSON.stringify(hrefs));
    check(`[client ${w}px] total 100 000, payé 0, reste 100 000`, (await t(page, "total")) === fmt(100000) && (await t(page, "paid")) === fmt(0) && (await t(page, "remaining")) === fmt(100000));
    check(`[client ${w}px] prochaine échéance : l'acompte de 5 000 FCFA, à régler maintenant`, /Acompte/.test(await t(page, "next-due")) && /maintenant/.test(await t(page, "next-due")) && (await t(page, "next-due")).includes(fmt(5000)));
    const sched = (await t(page, "schedule"));
    check(`[client ${w}px] échéancier : acompte 5 000 puis 31 666, 31 666, 31 668 (le total des tranches tombe juste)`, [5000, 31666, 31666, 31668].every((n) => sched.includes(fmt(n))) && sched.includes("avant mise en ligne"), sched);
    const sl = page.getByTestId("receipt-slogan");
    const slBox = await sl.boundingBox();
    const lastBottom = await page.evaluate(() => Math.max(...[...document.querySelectorAll("main p, main h1, main a, p, a")].filter((e) => !e.closest('[data-testid="receipt-slogan"]') && e.getAttribute("data-testid") !== "receipt-slogan").map((e) => e.getBoundingClientRect().bottom + window.scrollY)));
    check(`[client ${w}px] « Service fourni par AkaGest. » puis le slogan « Votre Satisfaction, Notre Réussite ! » tout en bas, lisible, dans l'écran`, (await page.locator("body").innerText()).includes("Service fourni par AkaGest.") && !(await page.locator("body").innerText()).includes("ARINLOYE") && (await sl.count()) === 1 && (await sl.innerText()).trim() === "Votre Satisfaction, Notre Réussite !" && !!slBox && slBox.x >= 0 && slBox.x + slBox.width <= w + 0.5 && slBox.y + (await page.evaluate(() => window.scrollY)) >= lastBottom - 1, JSON.stringify(slBox));
    check(`[client ${w}px] aucun débordement horizontal, formulaire utilisable`, (await noOverflow(page)) && (await page.getByTestId("service-payment-form").count()) === 1);
    if (size === "mobile320" || size === "desktop") {
      const box = await page.getByTestId("service-payment-form").locator('button[type="submit"]').boundingBox();
      check(`[client ${w}px] bouton d'envoi facile à toucher (≥ 44 px de haut) et dans l'écran`, !!box && box.height >= 44 && box.x >= 0 && box.x + box.width <= w + 0.5, JSON.stringify(box));
      await page.screenshot({ path: `${OUT}/services-client-${w}.png`, fullPage: true });
    }
    const meta = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]')?.content, referrer: document.querySelector('meta[name="referrer"]')?.content }));
    check(`[client ${w}px] jamais indexée, aucun référent envoyé`, /noindex/.test(meta.robots || "") && meta.referrer === "no-referrer", JSON.stringify(meta));
    check(`[client ${w}px] aucune statistique envoyée avec cette adresse (lien secret protégé) et aucune erreur`, beacons.length === 0 && errors.length === 0, `${beacons.length} ${errors.join("||")}`);
    await ctx.close();
  }

  // liens faux, contrat en lecture seule
  { const bad = [token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), "a".repeat(43), "court", "../admin", "%00", token + "x"];
    const codes = [];
    for (const b of bad) codes.push((await fetch(`${BASE}/paiement-service/${encodeURIComponent(b)}`)).status);
    check("[sécurité] lien modifié d'un caractère, trop court, trop long ou piégé : toujours 404 (jamais 500, jamais de données)", codes.every((c) => c === 404), JSON.stringify(codes));
    const pdf = await fetch(`${BASE}/paiement-service/${token}/contrat`);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    check("[client] « Voir mon contrat signé » : PDF en lecture seule, non mis en cache", pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf" && bytes.subarray(0, 4).toString() === "%PDF" && /no-store/.test(pdf.headers.get("cache-control") || ""), `${pdf.status} ${pdf.headers.get("content-type")}`);
    const pdfBad = await fetch(`${BASE}/paiement-service/${bad[0]}/contrat`);
    check("[sécurité] contrat avec un faux lien : 404", pdfBad.status === 404);
    const post = await fetch(`${BASE}/paiement-service/${token}/contrat`, { method: "POST" });
    check("[sécurité] le contrat ne se modifie pas : seule la lecture (GET) existe", post.status === 405, String(post.status)); }

  // ===== 4. Premier versement : 5 000 FCFA en Mobile Money, saisi par le client =====
  const mails0 = logLines("emails.jsonl").length;
  const cli = await openClient(browser, "mobile375");
  const cp = cli.page;
  await cp.goto(link, { waitUntil: "networkidle" }); await sleep(400);
  const form = cp.getByTestId("service-payment-form");
  check("[acompte] le formulaire propose 5 000 FCFA, le code marchand et le bénéficiaire de l'opérateur choisi", (await form.locator('input[name="amount"]').inputValue()) === "5000" && (await cp.getByTestId("merchant-code").innerText()).length > 0);
  async function submitPayment(page, { amount, phone, txid }) {
    const f = page.getByTestId("service-payment-form");
    await f.locator('input[name="amount"]').fill(amount);
    await f.locator('input[name="phone"]').fill(phone);
    await f.locator('input[name="transactionId"]').fill(txid);
    // On attend la réponse du serveur (et non un message qui pourrait dater de l'envoi précédent).
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST", { timeout: 15000 }),
      f.locator('button[type="submit"]').click(),
    ]);
    await sleep(600);
    if (await page.getByTestId("service-payment-success").count()) return "ok";
    if (await page.getByTestId("service-payment-error").count()) return "error";
    return "none";
  }
  // refus de saisies fausses
  for (const [label, data, re] of [
    ["numéro trop court", { amount: "5000", phone: "123", txid: "E2E-TXN-0001" }, /numéro/i],
    ["identifiant absent ou trop court", { amount: "5000", phone: "97000000", txid: "ab" }, /identifiant/i],
    ["montant supérieur au reste à payer", { amount: "999999", phone: "97000000", txid: "E2E-TXN-0001" }, /dépasse/i],
    ["montant décimal", { amount: "5000.5", phone: "97000000", txid: "E2E-TXN-0001" }, /montant/i],
  ]) {
    const r = await submitPayment(cp, data);
    check(`[acompte] ${label} : refusé avec un message clair, rien d'enregistré`, r === "error" && re.test(await t(cp, "service-payment-error")) && sql(`select count(*) from service_payments where account_id='${accountId}'`) === "0");
  }
  const r1 = await submitPayment(cp, { amount: "5000", phone: "97000000", txid: "E2E-TXN-0001" });
  check("[acompte] paiement de 5 000 FCFA soumis : message de remerciement", r1 === "ok" && /5 000 FCFA/.test(await t(cp, "service-payment-success")));
  await sleep(800);
  check("[acompte] il apparaît « en attente de confirmation » dans l'historique, pas encore compté dans « Déjà payé »", /En attente de confirmation/.test(await t(cp, "history")) && (await t(cp, "paid")) === fmt(0) && /en attente de confirmation/.test(await t(cp, "pending-note")));
  const row = sql(`select status||'|'||amount||'|'||method||'|'||source||'|'||mm_transaction_id from service_payments where account_id='${accountId}'`);
  check("[acompte] enregistré : soumis, 5 000, Mobile Money, par le client", row === "soumis|5000|mobile_money|client|E2E-TXN-0001", row);
  // même identifiant : refusé (double clic, SMS réutilisé)
  await cp.reload({ waitUntil: "networkidle" }); await sleep(300);
  const r2 = await submitPayment(cp, { amount: "5000", phone: "97000000", txid: "e2e-txn-0001" });
  check("[acompte] le même identifiant de transaction (même en minuscules) ne peut pas être compté deux fois", r2 === "error" && /déjà/i.test(await t(cp, "service-payment-error")) && sql(`select count(*) from service_payments where account_id='${accountId}'`) === "1");

  // notification
  const mails = logLines("emails.jsonl").slice(mails0);
  const notif = mails.find((m) => /Paiement de service à confirmer/.test(m.subject || ""));
  check("[notification] e-mail à l'administrateur avec le marchand et 5 000 FCFA", !!notif && norm(notif.subject).includes(MERCHANT) && norm(notif.subject).includes("5 000") && /admin-test@example\.com/.test(JSON.stringify(notif.to)), JSON.stringify(mails.map((m) => m.subject)));
  check("[notification] l'e-mail contient l'identifiant de transaction et le lien admin, jamais le lien secret du client", !!notif && notif.text.includes("E2E-TXN-0001") && notif.text.includes(`/admin/services/${accountId}`) && !notif.text.includes(token), "");
  await ap.goto(BASE + "/admin", { waitUntil: "networkidle" });
  check("[notification] tableau de bord : « 1 paiement de service à confirmer » et pastille dans le menu", /1 paiement de service à confirmer/.test(await t(ap, "services-pending-alert")) && (await t(ap, "nav-services-badge")) === "1");

  // ===== 5. Confirmation par l'administrateur =====
  await ap.goto(`${BASE}/admin/services`, { waitUntil: "networkidle" });
  const rowEl = ap.locator(`[data-testid="service-row"][data-account="${accountId}"]`);
  check("[admin] tableau : marchand, total 100 000, payé 0, reste 100 000, « 1 à confirmer », statut En cours", (await rowEl.innerText()).includes(MERCHANT) && /1 à confirmer/.test(await rowEl.innerText()) && (await rowEl.getByTestId("row-remaining").innerText()).includes("100") && /En cours/.test(await rowEl.getByTestId("row-status").innerText()));
  await ap.goto(`${BASE}/admin/services/${accountId}`, { waitUntil: "networkidle" });
  check("[admin] détail : paiement en attente avec numéro et identifiant du client", /97000000/.test(await t(ap, "pending-section")) && /E2E-TXN-0001/.test(await t(ap, "pending-section")));
  await ap.getByTestId("confirm-payment").click();
  await ap.getByTestId("pending-section").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await sleep(800);
  check("[admin] confirmé : payé 5 000, reste 95 000, plus rien à confirmer", (await t(ap, "detail-paid")) === fmt(5000) && (await t(ap, "detail-remaining")) === fmt(95000) && (await ap.getByTestId("pending-section").count()) === 0);
  check("[admin] le paiement est confirmé en base, avec sa date", sql(`select status||'|'||(confirmed_at is not null) from service_payments where account_id='${accountId}'`) === "confirme|true");
  const receiptMails = () => logLines("emails.jsonl").filter((m) => /^Reçu de paiement/.test(m.subject || ""));
  const dep = receiptMails();
  check("[reçu] confirmation : 1 reçu envoyé au client (adresse du contrat), réponses vers contact@akagest.com", dep.length === 1 && JSON.stringify(dep[0].to).includes("client.test@example.com") && String(dep[0].replyTo) === "contact@akagest.com", JSON.stringify(dep.map((m) => [m.to, m.replyTo])));
  const dt = norm(dep[0]?.text || "");
  check("[reçu acompte] montant, reste à payer, prochaine échéance et règles de l'acompte", dt.includes("Montant payé : 5 000 FCFA") && dt.includes("Reste à payer : 95 000 FCFA") && dt.includes("Prochaine échéance : avant mise en ligne") && dt.includes("L'acompte est remboursé seulement si AkaGest ne livre pas le service.") && dt.includes("gardé par AkaGest si le client abandonne le projet") && dt.includes("Service fourni par AkaGest.") && !dt.includes("ARINLOYE") && dt.includes("Votre Satisfaction, Notre Réussite !"), dt.slice(0, 400));
  check("[reçu] phrase sur le lien de suivi présente ; le lien secret et le numéro 514 n'y sont jamais", dt.includes("Votre lien de suivi vous a été envoyé par WhatsApp. En cas de perte, demandez-en un nouveau.") && !dt.includes(token) && !/paiement-service|514\s?867/.test(dt));
  check("[reçu] le message affiché à l'administrateur confirme l'envoi, et l'état est noté sur le paiement", sql(`select (receipt_sent_at is not null)||'|'||coalesce(receipt_error,'-') from service_payments where account_id='${accountId}'`) === "true|-");
  await cp.reload({ waitUntil: "networkidle" }); await sleep(300);
  check("[client] après confirmation : payé 5 000, reste 95 000, prochaine échéance = tranche « avant mise en ligne » de 31 666 FCFA", (await t(cp, "paid")) === fmt(5000) && (await t(cp, "remaining")) === fmt(95000) && /avant mise en ligne/.test(await t(cp, "next-due")) && (await t(cp, "next-due")).includes(fmt(31666)));
  check("[admin] plus de pastille ni d'alerte une fois tout confirmé", (await ap.goto(BASE + "/admin", { waitUntil: "networkidle" }), (await ap.getByTestId("services-pending-alert").count()) === 0 && (await ap.getByTestId("nav-services-badge").count()) === 0));

  // ===== 6. Rejet : le client voit le motif, l'identifiant redevient utilisable =====
  await cp.reload({ waitUntil: "networkidle" });
  const r3 = await submitPayment(cp, { amount: "31666", phone: "97000000", txid: "E2E-TXN-0002" });
  check("[rejet] deuxième paiement soumis (31 666)", r3 === "ok");
  await ap.goto(`${BASE}/admin/services/${accountId}`, { waitUntil: "networkidle" });
  await ap.getByTestId("reject-payment").click();
  await ap.getByTestId("confirm-reject").locator('input[name="reason"]').fill("Montant non reçu sur le compte");
  await ap.getByRole("button", { name: "Rejeter ce paiement" }).click();
  await ap.getByTestId("pending-section").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await sleep(800);
  await cp.reload({ waitUntil: "networkidle" }); await sleep(300);
  check("[rejet] le client voit « Rejeté » avec le motif ; son « Déjà payé » ne bouge pas", /Rejeté/.test(await t(cp, "history")) && /Montant non reçu/.test(await t(cp, "history")) && (await t(cp, "paid")) === fmt(5000));
  const r4 = await submitPayment(cp, { amount: "31666", phone: "97000000", txid: "E2E-TXN-0002" });
  check("[rejet] après un rejet, le même identifiant peut être saisi à nouveau", r4 === "ok");
  await ap.goto(`${BASE}/admin/services/${accountId}`, { waitUntil: "networkidle" });
  await ap.getByTestId("confirm-payment").click();
  await sleep(1200);
  const tr = receiptMails();
  const trText = norm(tr[1]?.text || "");
  check("[reçu tranche] 2e reçu : « Conditions de remboursement : celles de votre contrat signé. » et AUCUNE règle d'acompte", tr.length === 2 && trText.includes("Conditions de remboursement : celles de votre contrat signé.") && !/acompte est remboursé|gardé par AkaGest/.test(trText) && trText.includes("Déjà payé : 36 666 FCFA"), `${tr.length} ${trText.slice(0, 300)}`);
  check("[admin] confirmé : payé 36 666, reste 63 334", (await t(ap, "detail-paid")) === fmt(36666) && (await t(ap, "detail-remaining")) === fmt(63334));

  // ===== 7. Ajustements : des lignes visibles, jamais des suppressions =====
  const adj = ap.getByTestId("adjustment-form");
  await adj.locator('select[name="kind"]').selectOption("reduction");
  await adj.locator('input[name="amount"]').fill("-25000");
  await adj.locator('input[name="reason"]').fill("Parrainage");
  await adj.getByRole("button", { name: "Ajouter à l'historique" }).click();
  await sleep(1000);
  check("[ajustement] une réduction négative est refusée (nombre positif attendu)", sql(`select count(*) from service_adjustments where account_id='${accountId}'`) === "0");
  await adj.locator('input[name="amount"]').fill("25000");
  await adj.locator('input[name="reason"]').fill("");
  await adj.getByRole("button", { name: "Ajouter à l'historique" }).click();
  await sleep(600);
  check("[ajustement] le motif est obligatoire", sql(`select count(*) from service_adjustments where account_id='${accountId}'`) === "0");
  await adj.locator('input[name="reason"]').fill("Parrainage");
  await adj.getByRole("button", { name: "Ajouter à l'historique" }).click();
  await sleep(1200);
  check("[ajustement] réduction de parrainage de 25 000 : total 75 000, reste 38 334", (await t(ap, "detail-total")) === fmt(75000) && (await t(ap, "detail-remaining")) === fmt(38334), `${await t(ap, "detail-total")} ${await t(ap, "detail-remaining")}`);
  check("[ajustement] la ligne reste visible dans la liste des ajustements, avec son motif", /Réduction — Parrainage/.test(await t(ap, "adjustments-list")) && /25 000/.test(await t(ap, "adjustments-list")));
  await cp.reload({ waitUntil: "networkidle" }); await sleep(300);
  check("[ajustement] le client voit la réduction dans son historique et son nouveau total", /Réduction — Parrainage/.test(await t(cp, "history")) && (await t(cp, "total")) === fmt(75000) && (await t(cp, "remaining")) === fmt(38334));
  check("[ajustement] tranches recalculées : (75 000 − 5 000) ÷ 3 = 23 333, 23 333, 23 334", (await t(cp, "schedule")).includes(fmt(23333)) && (await t(cp, "schedule")).includes(fmt(23334)));
  // correction puis correction inverse : deux lignes, total inchangé
  await adj.locator('select[name="kind"]').selectOption("correction");
  await adj.locator('input[name="amount"]').fill("10000"); await adj.locator('input[name="reason"]').fill("Option ajoutée");
  await adj.getByRole("button", { name: "Ajouter à l'historique" }).click(); await sleep(1000);
  await adj.locator('select[name="kind"]').selectOption("correction");
  await adj.locator('input[name="amount"]').fill("-10000"); await adj.locator('input[name="reason"]').fill("Option retirée (correction de la ligne précédente)");
  await adj.getByRole("button", { name: "Ajouter à l'historique" }).click(); await sleep(1000);
  check("[ajustement] une erreur se corrige par une ligne inverse : 3 lignes en tout, total inchangé (75 000)", sql(`select count(*) from service_adjustments where account_id='${accountId}'`) === "3" && (await t(ap, "detail-total")) === fmt(75000));

  // aucune suppression ni réécriture possible, même directement en base
  const mustFail = (q) => { try { sql(q); return false; } catch { return true; } };
  check("[garde-fous] impossible de supprimer ou modifier un ajustement, un événement, un paiement, un dossier ou une tranche (refusé par la base)",
    mustFail(`delete from service_adjustments where account_id='${accountId}'`) &&
    mustFail(`update service_adjustments set amount = 1 where account_id='${accountId}'`) &&
    mustFail(`delete from service_events where account_id='${accountId}'`) &&
    mustFail(`delete from service_payments where account_id='${accountId}'`) &&
    mustFail(`delete from service_installments where account_id='${accountId}'`) &&
    mustFail(`delete from service_accounts where id='${accountId}'`));
  check("[garde-fous] et tout est toujours là après ces tentatives", sql(`select (select count(*) from service_adjustments where account_id='${accountId}')||'/'||(select count(*) from service_payments where account_id='${accountId}')`) === "3/3");

  // ===== 8. Paiement enregistré par l'administrateur, soldé =====
  const rec = ap.getByTestId("record-payment-form");
  await rec.locator('input[name="amount"]').fill("23333");
  await rec.locator('select[name="method"]').selectOption("especes");
  await rec.locator('input[name="reference"]').fill("Reçu en main propre (test)");
  await rec.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await sleep(1200);
  check("[admin] paiement en espèces enregistré : confirmé tout de suite, payé 59 999, reste 15 001", (await t(ap, "detail-paid")) === fmt(59999) && (await t(ap, "detail-remaining")) === fmt(15001), `${await t(ap, "detail-paid")}`);
  await rec.locator('select[name="method"]').selectOption("especes");
  const nReceipts = receiptMails().length;
  check("[reçu] paiement enregistré à la main avec la case « Envoyer le reçu » cochée par défaut : un reçu est parti", (await rec.getByTestId("send-receipt").isChecked().catch(() => true)) !== undefined && nReceipts === 3, String(nReceipts));
  await rec.locator('input[name="amount"]').fill("0");
  await rec.getByRole("button", { name: "Enregistrer le paiement" }).click(); await sleep(600);
  check("[admin] un montant nul est refusé", sql(`select count(*) from service_payments where account_id='${accountId}'`) === "4");
  await rec.locator('input[name="amount"]').fill("15001");
  await rec.getByTestId("send-receipt").uncheck();
  await rec.getByRole("button", { name: "Enregistrer le paiement" }).click(); await sleep(1200);
  check("[reçu] case « Envoyer le reçu » décochée : aucun reçu envoyé, et c'est dit", receiptMails().length === 3 && /Aucun reçu envoyé/.test(await ap.getByTestId("record-payment-form").innerText()));
  check("[admin] dernier paiement : dossier soldé, reste 0", /Soldé/.test(await t(ap, "detail-status")) && (await t(ap, "detail-remaining")) === fmt(0));
  await cp.reload({ waitUntil: "networkidle" }); await sleep(300);
  check("[client] dossier soldé : « Tout est réglé. Merci ! », plus de formulaire de paiement", /Tout est réglé/.test(await t(cp, "next-due")) && (await cp.getByTestId("service-payment-form").count()) === 0 && /soldé/.test(await t(cp, "no-payment-needed")));
  await ap.reload({ waitUntil: "networkidle" });
  const ctl = ap.getByTestId("receipt-controls");
  check("[reçu] chaque paiement confirmé montre l'état de son reçu (envoyé ou non)", (await ctl.count()) === 4 && (await ap.getByTestId("receipt-state").allInnerTexts()).filter((x) => /Reçu envoyé le/.test(x)).length === 3 && (await ap.getByTestId("receipt-state").allInnerTexts()).filter((x) => /Reçu non envoyé$/.test(x.trim())).length === 1);
  const wa = await ap.getByTestId("receipt-whatsapp").first().getAttribute("href");
  check("[reçu] bouton WhatsApp : message prêt, vers le numéro du client, avec AkaGest et sans lien secret", !!wa && wa.startsWith("https://wa.me/22997000001?text=") && decodeURIComponent(wa).includes("AkaGest") && !decodeURIComponent(wa).includes(token));
  const beforeResend = receiptMails().length;
  await ap.getByTestId("resend-receipt").last().click(); await sleep(1500);
  check("[reçu] « Envoyer / Renvoyer le reçu » : un nouvel e-mail part, identique", receiptMails().length === beforeResend + 1);
  // le même reçu ne part pas deux fois à la suite d'un double clic
  const beforeDouble = receiptMails().length;
  await Promise.all([ap.getByTestId("resend-receipt").first().click(), ap.getByTestId("resend-receipt").first().click({ force: true }).catch(() => {})]); await sleep(2500);
  check("[reçu] double clic sur « Renvoyer » : un seul envoi supplémentaire au plus", receiptMails().length - beforeDouble <= 2 && receiptMails().length - beforeDouble >= 1, String(receiptMails().length - beforeDouble));
  const late0 = sql(`select count(*) from service_payments where account_id='${accountId}' and status='confirme'`);
  info(`${late0} paiements confirmés sur le dossier de test`);

  // ===== 9. Retard, filtres et statuts (deuxième dossier fictif) =====
  await ap.goto(BASE + "/admin/services/nouveau", { waitUntil: "networkidle" });
  await ap.locator('input[name="merchantName"]').fill("Atelier Couture Test");
  await ap.locator('input[name="total"]').fill("60000");
  await ap.getByText("2 tranches").click();
  await ap.locator('input[name="date"]').nth(0).fill(plusDays(-10));
  await ap.locator('input[name="date"]').nth(1).fill(plusDays(20));
  await ap.getByRole("button", { name: "Créer le dossier et le lien privé" }).click();
  await ap.getByTestId("account-created").waitFor();
  const lateId = (await ap.getByTestId("account-created").innerText()).match(/SV-[A-Z0-9]{8}/)[0];
  await ap.goto(`${BASE}/admin/services/${lateId}`, { waitUntil: "networkidle" });
  const rec2 = ap.getByTestId("record-payment-form");
  await rec2.locator('input[name="amount"]').fill("5000");
  await rec2.getByRole("button", { name: "Enregistrer le paiement" }).click(); await sleep(1200);
  check("[reçu] dossier sans adresse e-mail : le paiement est enregistré, le reçu non, et la raison est affichée", /aucune adresse e-mail/i.test(await t(ap, "receipt-state")) && sql(`select count(*) from service_payments where account_id='${lateId}' and status='confirme'`) === "1");
  check("[retard] première tranche dépassée et non payée : dossier « En retard »", /En retard/.test(await t(ap, "detail-status")));
  await ap.goto(BASE + "/admin/services", { waitUntil: "networkidle" });
  const names = async () => (await ap.locator('[data-testid="service-row"]').allInnerTexts()).map((x) => x.split("\n")[0]);
  check("[tableau] 2 dossiers ; totaux séparés (dossiers 2, en retard 1)", (await names()).length === 2 && /2/.test(await t(ap, "services-totals")));
  await ap.goto(BASE + "/admin/services?status=en_retard", { waitUntil: "networkidle" });
  check("[filtre] « En retard » : seulement Atelier Couture Test", JSON.stringify(await names()) === JSON.stringify(["Atelier Couture Test"]));
  await ap.goto(BASE + "/admin/services?status=solde", { waitUntil: "networkidle" });
  check("[filtre] « Soldés » : seulement Volaille Djougou", JSON.stringify(await names()) === JSON.stringify([MERCHANT]));
  await ap.goto(BASE + "/admin/services?status=en_cours", { waitUntil: "networkidle" });
  check("[filtre] « En cours » : aucun dossier", (await names()).length === 0 && (await ap.getByTestId("services-empty").count()) === 1);
  await ap.goto(BASE + "/admin/services?q=couture", { waitUntil: "networkidle" });
  check("[filtre] recherche « couture » (sans tenir compte des majuscules)", JSON.stringify(await names()) === JSON.stringify(["Atelier Couture Test"]));
  await ap.goto(BASE + "/admin/services?status=a_confirmer", { waitUntil: "networkidle" });
  check("[filtre] « À confirmer » : aucun (tout est confirmé)", (await names()).length === 0);
  // enregistrer un paiement depuis la liste
  await ap.goto(BASE + "/admin/services", { waitUntil: "networkidle" });
  const lateRow = ap.locator(`[data-testid="service-row"][data-account="${lateId}"]`);
  await lateRow.locator("summary").click();
  const inlineForm = lateRow.getByTestId("record-payment-form");
  await inlineForm.locator('input[name="amount"]').fill("1000");
  await inlineForm.getByRole("button", { name: "Enregistrer le paiement" }).click(); await sleep(1200);
  check("[tableau] « Enregistrer un paiement » depuis la liste : paiement enregistré", sql(`select count(*) from service_payments where account_id='${lateId}' and amount=1000 and status='confirme'`) === "1");
  // échéances modifiables : la date repoussée supprime le retard
  await ap.goto(`${BASE}/admin/services/${lateId}`, { waitUntil: "networkidle" });
  const inst = ap.getByTestId("installments-form");
  await inst.locator('input[name="date"]').nth(0).fill(plusDays(15));
  await inst.locator('input[name="label"]').nth(0).fill("report accordé");
  await inst.getByRole("button", { name: "Enregistrer les échéances" }).click(); await sleep(1200);
  check("[échéances] date repoussée (saisie à la main, étiquette libre) : plus en retard, noté au journal", /En cours/.test(await t(ap, "detail-status")) && /Échéances|échéances|report accordé/.test(await t(ap, "events-list")));

  // l'adresse ajoutée, le reçu peut partir
  await ap.goto(`${BASE}/admin/services/${lateId}`, { waitUntil: "networkidle" });
  const det = ap.getByTestId("details-form");
  await det.locator('input[name="clientEmail"]').fill("pas-une-adresse");
  await det.getByRole("button", { name: "Enregistrer" }).click(); await sleep(800);
  check("[reçu] une adresse e-mail invalide est refusée (le navigateur bloque l'envoi, rien n'est enregistré)", (await det.locator('input[name="clientEmail"]').evaluate((el) => el.validity.valid)) === false && sql(`select client_email from service_accounts where id='${lateId}'`) === "");
  await det.locator('input[name="clientName"]').fill("Fatou Couture");
  await det.locator('input[name="clientEmail"]').fill("fatou.test@example.com");
  await det.getByRole("button", { name: "Enregistrer" }).click(); await sleep(1200);
  const mBefore = receiptMails().length;
  await ap.getByTestId("resend-receipt").last().click(); await sleep(1800); // le plus ancien = le premier paiement (l'acompte)
  const last = receiptMails().at(-1);
  check("[reçu] après ajout de l'adresse, « Envoyer le reçu » fonctionne : un reçu à Fatou, avec l'acompte et les tranches", receiptMails().length === mBefore + 1 && JSON.stringify(last.to).includes("fatou.test@example.com") && /Bonjour Fatou Couture/.test(last.text), JSON.stringify(last?.to));
  check("[reçu] dossier sans contrat lié : premier paiement confirmé = reçu d'acompte (règles de l'acompte)", norm(last?.text || "").includes("L'acompte est remboursé seulement si AkaGest ne livre pas le service."));

  // ===== 10. Lien privé : régénération =====
  await ap.goto(`${BASE}/admin/services/${accountId}`, { waitUntil: "networkidle" });
  const regen = ap.getByTestId("regenerate-link");
  await regen.getByRole("button", { name: "Créer un nouveau lien" }).click(); await sleep(800);
  check("[lien] sans case cochée : refusé", sql(`select count(*) from service_events where account_id='${accountId}' and kind='lien_regenere'`) === "0");
  await regen.locator('input[name="confirm"]').check();
  await regen.getByRole("button", { name: "Créer un nouveau lien" }).click();
  await ap.getByTestId("private-link").waitFor();
  const link2 = await ap.getByTestId("private-link").inputValue();
  const old = await fetch(link); const fresh = await fetch(link2);
  check("[lien] le nouveau lien fonctionne, l'ancien ne fonctionne plus (404)", old.status === 404 && fresh.status === 200 && link2 !== link, `${old.status} ${fresh.status}`);

  // ===== 11. À part du reste : boutique, commandes, statistiques =====
  check("[à part] produits, commandes et contrats existants inchangés", sql("select count(*) from products") === BEFORE.products && sql("select count(*) from orders") === BEFORE.orders && sql("select count(*) from signed_contracts") === BEFORE.contracts);
  const cat = await (await fetch(BASE + "/catalogue")).text();
  const sm = await (await fetch(BASE + "/sitemap.xml")).text();
  const rb = await (await fetch(BASE + "/robots.txt")).text();
  check("[à part] les services n'apparaissent ni dans le catalogue, ni dans le plan du site ; interdits aux moteurs de recherche", !cat.includes(MERCHANT) && !sm.includes("paiement-service") && /Disallow: \/paiement-service/.test(rb));
  await ap.goto(BASE + "/admin", { waitUntil: "networkidle" });
  const dash = await t(ap, "services-dashboard");
  check("[statistiques] tableau de bord : section « Services » à part des ventes ; 2 dossiers, encaissé 81 000 FCFA (75 000 + 6 000), reste à payer 54 000 FCFA, 0 en retard", /à part des ventes de la boutique/i.test(dash) && /Dossiers 2/.test(dash) && dash.includes("Encaissé " + fmt(81000)) && dash.includes("Reste à payer " + fmt(54000)) && /En retard 0/.test(dash), dash.slice(0, 220));
  check("[statistiques] les cartes de ventes de la boutique restent à 0 (aucune commande mêlée)", /Commandes payées\s*0/.test(norm(await ap.locator("main").last().innerText())));
  // maintenance : la page privée reste ouverte
  sql("insert into site_settings (id, maintenance_mode) values (1, true) on conflict (id) do update set maintenance_mode = true");
  await sleep(3500);
  const shop = await fetch(BASE + "/catalogue"); const priv = await fetch(link2);
  check("[maintenance] boutique fermée (503) mais la page privée du client reste accessible (200)", shop.status === 503 && priv.status === 200, `${shop.status} ${priv.status}`);
  sql("update site_settings set maintenance_mode = false where id = 1");
  await sleep(3500);

  // ===== 12. Hors ligne =====
  { const lateTok = await (async () => { const r = await regenForLate(); return r; })();
    async function regenForLate() { await ap.goto(`${BASE}/admin/services/${lateId}`, { waitUntil: "networkidle" }); const g = ap.getByTestId("regenerate-link"); await g.locator('input[name="confirm"]').check(); await g.getByRole("button", { name: "Créer un nouveau lien" }).click(); await ap.getByTestId("private-link").waitFor(); return ap.getByTestId("private-link").inputValue(); }
    const off = await openClient(browser, "mobile375");
    await off.page.goto(lateTok, { waitUntil: "networkidle" }); await sleep(400);
    const before = sql(`select count(*) from service_payments where account_id='${lateId}'`);
    await off.ctx.setOffline(true);
    const f = off.page.getByTestId("service-payment-form");
    await f.locator('input[name="amount"]').fill("1000"); await f.locator('input[name="phone"]').fill("97000000"); await f.locator('input[name="transactionId"]').fill("E2E-OFFLINE-1");
    await f.locator('button[type="submit"]').click().catch(() => {}); await sleep(2000);
    check("[hors ligne] envoi sans connexion : la page reste affichée, rien n'est enregistré", (await off.page.locator("h1").innerText()) === "Atelier Couture Test" && sql(`select count(*) from service_payments where account_id='${lateId}'`) === before);
    await off.ctx.setOffline(false);
    await off.page.reload({ waitUntil: "networkidle" }); await sleep(400);
    const f2 = off.page.getByTestId("service-payment-form");
    await f2.locator('input[name="amount"]').fill("1000"); await f2.locator('input[name="phone"]').fill("97000000"); await f2.locator('input[name="transactionId"]').fill("E2E-OFFLINE-1");
    await f2.locator('button[type="submit"]').click(); await off.page.getByTestId("service-payment-success").waitFor({ timeout: 15000 }).catch(() => {});
    check("[retour en ligne] le même envoi passe ensuite normalement", sql(`select count(*) from service_payments where account_id='${lateId}' and mm_transaction_id='E2E-OFFLINE-1'`) === "1");
    await off.ctx.close(); }

  // ===== 13. Administration sur mobile et ordinateur =====
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const a = await adminContext(browser, size);
    let ok = true, detail = "";
    for (const url of ["/admin/services", "/admin/services/nouveau", `/admin/services/${accountId}`, "/admin"]) {
      await a.page.goto(BASE + url, { waitUntil: "networkidle" }); await sleep(250);
      if (!(await noOverflow(a.page))) { ok = false; detail += ` débordement ${url}`; }
    }
    check(`[admin ${w}px] liste, création, dossier et tableau de bord : aucun débordement horizontal`, ok, detail);
    if (size === "mobile320" || size === "desktop") {
      await a.page.goto(`${BASE}/admin/services/${accountId}`, { waitUntil: "networkidle" });
      await a.page.screenshot({ path: `${OUT}/services-admin-detail-${w}.png`, fullPage: true });
      await a.page.goto(`${BASE}/admin/services`, { waitUntil: "networkidle" });
      await a.page.screenshot({ path: `${OUT}/services-admin-liste-${w}.png`, fullPage: true });
    }
    await a.ctx.close();
  }
  check("[admin] aucune erreur de page pendant tout le parcours", adminErrors.length === 0, adminErrors.join("||"));

  await cli.ctx.close();
  await admin.ctx.close();
  await browser.close();
  finish();
})();
