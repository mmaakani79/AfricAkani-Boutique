// Vercel Web Analytics : ce qui est envoyé, ce qui ne l'est pas, de bout en bout.
// Le vrai script de Vercel (/_vercel/insights/script.js) n'existe que chez Vercel :
// on le remplace par un script de substitution qui respecte le contrat de
// @vercel/analytics (file d'attente window.vaq, "beforeSend", "pageview", envoi
// vers /_vercel/insights/view). Le composant et le filtre testés sont les vrais.
const fs = require("fs");
const path = require("path");
const { BASE, OUT, ADMIN_PW, SIZES, check, sleep, finish, sql, launch, noOverflow } = require("../lib/common.cjs");

// Script de substitution (contrat de @vercel/analytics lu dans son code source).
const FAKE_SCRIPT = fs.readFileSync(path.join(__dirname, "../lib/fake-analytics-script.js"), "utf8");

async function open(browser, size, { withScript = true, offlineAfter = false } = {}) {
  const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
  const beacons = [];
  await ctx.route("**/_vercel/insights/script.js", (r) => withScript
    ? r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SCRIPT })
    : r.fulfill({ status: 404, body: "not found" }));
  await ctx.route("**/_vercel/insights/view", (r) => { beacons.push(r.request().postData() || ""); r.fulfill({ status: 200, body: "ok" }); });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); if (m.type() === "log") logs.push(m.text()); });
  return { ctx, page, beacons, errors, logs };
}
const urls = (beacons) => beacons.map((b) => { try { return JSON.parse(b).o; } catch { return b; } });

(async () => {
  const browser = await launch();

  // ===== 1. La balise est chargée sur les pages publiques, et envoie une page vue propre =====
  { const { ctx, page, beacons, errors } = await open(browser, "desktop");
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(500);
    const tag = await page.evaluate(() => { const s = document.querySelector('script[src*="/_vercel/insights/script.js"]'); return s ? { src: s.getAttribute("src"), defer: s.defer, inHead: s.parentElement.tagName } : null; });
    check("[accueil] le script /_vercel/insights/script.js est ajouté (defer, dans <head>)", !!tag && tag.src === "/_vercel/insights/script.js" && tag.defer && tag.inHead === "HEAD", JSON.stringify(tag));
    check("[accueil] une page vue est envoyée avec l'adresse propre « /… »", urls(beacons).length === 1 && urls(beacons)[0] === BASE + "/", JSON.stringify(urls(beacons)));
    check("[accueil] aucune erreur dans la console", errors.length === 0, errors.join("||"));
    check("[accueil] aucun cookie posé au visiteur", (await ctx.cookies()).length === 0, JSON.stringify((await ctx.cookies()).map((c) => c.name)));
    await ctx.close(); }

  // ===== 2. Identifiants et mots de recherche : jamais envoyés =====
  { const { ctx, page, beacons } = await open(browser, "desktop");
    const SECRETS = ["AK-TESTE2E123", "cs_test_SECRETSESSION", "PAYPALTOKEN999", "motsecretrecherche", "PREVIEWKEY"];
    await page.goto(BASE + "/suivi?commande=AK-TESTE2E123", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/noter?commande=AK-TESTE2E123", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/commande/succes?session_id=cs_test_SECRETSESSION", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/commande/succes?token=PAYPALTOKEN999&order_id=AK-TESTE2E123", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/catalogue?q=motsecretrecherche&halal=oui#avis", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/?preview=PREVIEWKEY", { waitUntil: "networkidle" }); await sleep(400);
    const all = beacons.join("\n");
    check("[adresses] 6 pages vues envoyées", beacons.length === 6, `${beacons.length}`);
    check("[adresses] aucun identifiant de commande, jeton ni mot de recherche dans ce qui est envoyé", !SECRETS.some((s) => all.includes(s)), all);
    check("[adresses] aucune adresse envoyée ne contient « ? » ou « # »", urls(beacons).every((u) => !/[?#]/.test(u)), JSON.stringify(urls(beacons)));
    check("[adresses] le chemin reste visible (/suivi, /noter, /commande/succes, /catalogue)", ["/suivi", "/noter", "/commande/succes", "/catalogue"].every((p) => urls(beacons).some((u) => u === BASE + p)), JSON.stringify(urls(beacons)));
    // la recherche dans le catalogue ne change pas l'adresse mais on vérifie la saisie
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Rechercher un produit…").fill("secretfiltre"); await sleep(300);
    check("[adresses] saisie dans la recherche du catalogue : rien d'envoyé avec le mot saisi", !beacons.join("\n").includes("secretfiltre"));
    await ctx.close(); }

  // ===== 3. Navigation dans la boutique (changements de page sans rechargement) =====
  { const { ctx, page, beacons, errors } = await open(browser, "desktop");
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
    const before = beacons.length;
    await page.locator("a[href^='/produit/']").first().click(); await page.waitForURL(/\/produit\//); await sleep(600);
    const prodUrl = page.url();
    check("[navigation] ouverture d'un produit : une page vue de plus, adresse propre", beacons.length === before + 1 && urls(beacons).at(-1) === prodUrl.split("?")[0], JSON.stringify(urls(beacons)));
    await page.getByRole("button", { name: "Ajouter au panier" }).click(); await sleep(300);
    await page.goto(BASE + "/panier", { waitUntil: "networkidle" }); await sleep(400);
    await page.goto(BASE + "/commande", { waitUntil: "networkidle" }); await sleep(400);
    check("[navigation] panier et commande comptés", ["/panier", "/commande"].every((p) => urls(beacons).includes(BASE + p)), JSON.stringify(urls(beacons)));
    check("[navigation] aucune erreur", errors.length === 0, errors.join("||"));
    await ctx.close(); }

  // ===== 4. Administration : jamais comptée =====
  { const { ctx, page, beacons, errors } = await open(browser, "desktop");
    await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" }); await sleep(400);
    await page.locator('input[type="password"]').fill(ADMIN_PW); await page.locator('input[type="password"]').press("Enter"); await page.waitForURL(/\/admin\/?$/); await sleep(500);
    for (const p of ["/admin/produits", "/admin/commandes", "/admin/reglages", "/admin/demandes", "/admin"]) { await page.goto(BASE + p, { waitUntil: "networkidle" }); await sleep(350); }
    check("[admin] connexion et 5 pages d'administration visitées, aucune page vue envoyée", beacons.length === 0, JSON.stringify(urls(beacons)));
    // navigation douce depuis l'admin vers la boutique : le retour sur une page publique est compté
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(500);
    check("[admin] puis une page publique : comptée normalement (1 seule)", beacons.length === 1 && urls(beacons)[0] === BASE + "/", JSON.stringify(urls(beacons)));
    check("[admin] aucune erreur", errors.length === 0, errors.join("||"));
    await ctx.close(); }

  // ===== 5. Le proxy (maintenance) ne touche pas à /_vercel/ =====
  { sql("insert into site_settings (id, maintenance_mode) values (1, true) on conflict (id) do update set maintenance_mode = true");
    await sleep(3500); // le proxy garde la réponse 3 secondes
    const shop = await fetch(BASE + "/catalogue");
    check("[maintenance] la boutique est fermée (503) pour un visiteur", shop.status === 503, String(shop.status));
    const script = await fetch(BASE + "/_vercel/insights/script.js");
    const view = await fetch(BASE + "/_vercel/insights/view", { method: "POST", body: "{}" });
    check("[maintenance] /_vercel/insights/script.js n'est PAS remplacé par la page de maintenance (pas de 503)", script.status !== 503 && !(await script.text()).includes("maintenance"), String(script.status));
    check("[maintenance] /_vercel/insights/view : pas de 503 non plus", view.status !== 503, String(view.status));
    const adm = await fetch(BASE + "/admin/produits", { redirect: "manual" });
    check("[maintenance] l'admin reste protégé (redirection vers la connexion)", adm.status >= 300 && adm.status < 400 && (adm.headers.get("location") || "").includes("/admin/login"), `${adm.status} ${adm.headers.get("location")}`);
    sql("update site_settings set maintenance_mode = false where id = 1");
    await sleep(3500);
    const shop2 = await fetch(BASE + "/catalogue");
    check("[maintenance] réouverture : la boutique répond de nouveau (200)", shop2.status === 200, String(shop2.status)); }

  // ===== 6. Sans script (pas encore activé chez Vercel, bloqueur de publicités) : le site fonctionne =====
  { const { ctx, page, beacons, errors, logs } = await open(browser, "desktop", { withScript: false });
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(500);
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(300);
    check("[script absent (404)] le site s'affiche et reste utilisable, aucune erreur de page", errors.length === 0 && (await page.locator("a[href^='/produit/']").count()) > 0, errors.join("||"));
    check("[script absent (404)] seul un message d'information est écrit dans la console (pas une erreur)", logs.some((l) => /Vercel Web Analytics/.test(l)) && beacons.length === 0, logs.join("|"));
    await ctx.close(); }

  // ===== 7. Hors ligne =====
  { const { ctx, page, beacons, errors } = await open(browser, "desktop");
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(500);
    const n = beacons.length;
    await ctx.setOffline(true);
    await page.locator("a[href^='/produit/']").first().click().catch(() => {}); await sleep(1200);
    check("[hors ligne] navigation sans réseau : pas d'erreur de page provoquée par les statistiques", errors.filter((e) => !/Failed to fetch|NetworkError|net::|ERR_INTERNET|Load failed|RSC|fetch/i.test(e)).length === 0, errors.join("||"));
    check("[hors ligne] rien n'est envoyé tant qu'il n'y a pas de réseau", beacons.length === n, `${beacons.length} vs ${n}`);
    await ctx.setOffline(false);
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(500);
    check("[retour en ligne] le comptage reprend", beacons.length > n, `${beacons.length} vs ${n}`);
    await ctx.close(); }

  // ===== 7b. Une commande complète fonctionne toujours (WhatsApp, zone Bénin) =====
  { const { ctx, page, beacons, errors } = await open(browser, "mobile375");
    await page.goto(BASE + "/produit/beurre-de-karite-pur", { waitUntil: "networkidle" }); await sleep(300);
    await page.getByRole("button", { name: "Ajouter au panier" }).click(); await sleep(300);
    await page.goto(BASE + "/commande", { waitUntil: "networkidle" }); await sleep(500);
    const form = page.locator("main form").first();
    await form.locator('input[type="text"]').nth(0).fill("Client Statistiques");
    await form.locator('input[type="tel"]').first().fill("+22997000000");
    await form.locator('input[type="email"]').fill("stats.test@example.com");
    await form.locator("label", { hasText: "Adresse de livraison" }).locator("input").fill("Rue 12, Cotonou");
    await form.locator("label", { hasText: "Ville" }).locator("input").first().fill("Cotonou");
    await form.locator('button[type="submit"]').click();
    const outcome = await Promise.race([
      page.getByText(/Merci,/).first().waitFor({ timeout: 15000 }).then(() => "confirmed"),
      page.locator("p.bg-red-50").first().waitFor({ timeout: 15000 }).then(() => "error"),
    ]).catch(() => "timeout");
    check("[commande] une commande WhatsApp complète est confirmée avec les statistiques en place", outcome === "confirmed", outcome);
    check("[commande] la commande est bien enregistrée", sql("select count(*) from orders where customer_email='stats.test@example.com'") === "1");
    check("[commande] aucun numéro de commande n'a été envoyé aux statistiques", !beacons.join("\n").match(/AK-[A-Z0-9]{4,}/), beacons.join("|"));
    check("[commande] aucune erreur", errors.length === 0, errors.join("||"));
    await ctx.close(); }

  // ===== 8. Mobile et tablette : aucun changement visible =====
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const { ctx, page, beacons, errors } = await open(browser, size);
    let ok = true, detail = "";
    for (const p of ["/", "/catalogue", "/panier", "/commande", "/notre-histoire", "/services"]) {
      await page.goto(BASE + p, { waitUntil: "networkidle" }); await sleep(300);
      if (!(await noOverflow(page))) { if (!(size === "mobile320" && p === "/panier")) { ok = false; detail += ` débordement ${p}`; } }
      if (!(await page.locator("header").first().isVisible()) || !(await page.locator("footer").first().isVisible())) { ok = false; detail += ` en-tête/pied absent ${p}`; }
    }
    check(`[${w}px] 6 pages : en-tête et pied de page visibles, pas de débordement dû aux statistiques`, ok, detail);
    check(`[${w}px] une page vue par page, aucune erreur`, beacons.length === 6 && errors.length === 0, `${beacons.length} ${errors.join("||")}`);
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.screenshot({ path: `${OUT}/analytics-accueil-${w}.png` });
    await ctx.close();
  }

  await browser.close();
  finish();
})();
