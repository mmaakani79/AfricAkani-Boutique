// Chantier A : visibilité par zone + cohérence adresse/zone, de bout en bout
// (vraie application, base locale jetable, faux Stripe / PayPal / Resend).
const { BASE, OUT, ADMIN_PW, SIZES, check, info, sleep, finish, sql, providerCalls, launch, noOverflow } = require("../lib/common.cjs");
const payments = providerCalls;

// ---------- Données de test (ajoutées à la base locale jetable) ----------
// Base neuve : on fixe l'état attendu (produits réservés au Bénin, etc.), puis nos produits de test.
sql("update products set price_ca = NULL, price_us = NULL where id = 'p04'"); // Savon noir : Bénin seul
sql("delete from products where id in ('t-na-only','t-nulle-part')");
sql("delete from categories where id='t-cat-na'");
sql("insert into categories (id, slug, name, description, featured_home, photo_seed, sort_order) values ('t-cat-na','t-cat-na','Rayon Amérique du Nord','Réservé au Canada et aux États-Unis',true,'emerald',999)");
sql(`insert into products (id,slug,name,category_id,halal,unit,packaging,price_bj,price_ca,price_us,stock,featured,sku,sort_order)
  select 't-na-only','t-na-only','Produit Amérique du Nord','t-cat-na',halal,unit,packaging,NULL,20,22,'en_stock',true,'T-NA',950 from products where id='p02'`);
sql(`insert into products (id,slug,name,category_id,halal,unit,packaging,price_bj,price_ca,price_us,stock,featured,sku,sort_order)
  select 't-nulle-part','t-nulle-part','Produit sans aucun prix',category_id,halal,unit,packaging,NULL,NULL,NULL,'en_stock',true,'T-NULL',951 from products where id='p02'`);
const countIn = (zone) => Number(sql(`select count(*) from products where price_${zone} is not null`));
const EXPECTED = { bj: countIn("bj"), ca: countIn("ca"), us: countIn("us") };
const TOTAL_LISTED = Number(sql("select count(*) from products where price_bj is not null or price_ca is not null or price_us is not null"));
info(`produits vendus par zone en base : ${JSON.stringify(EXPECTED)} — vendus quelque part : ${TOTAL_LISTED} — total en base : ${sql("select count(*) from products")}`);

async function open(browser, size, zone, extra = {}) {
  const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block", ...extra });
  if (zone) await ctx.addInitScript((z) => { try { if (!localStorage.getItem("africakani.zone")) localStorage.setItem("africakani.zone", z); } catch {} }, zone);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
const switchZone = async (page, id) => {
  const label = { bj: "Afrique (FCFA)", ca: "CA Canada", us: "US États-Unis" }[id];
  await page.locator("header [role=group]:visible").getByRole("button", { name: label }).click();
  await sleep(350);
};
const productNames = (page) => page.locator("a.line-clamp-2").allInnerTexts().then((a) => a.map((s) => s.trim()));
const count = async (page) => Number(((await page.getByTestId("catalogue-count").innerText()).match(/^(\d+)/) || [])[1]);

(async () => {
  const browser = await launch();

  // =============== 1. Catalogue : masquage par zone, compteurs, catégories, recherche ===============
  for (const zone of ["bj", "ca", "us"]) {
    const { ctx, page, errors } = await open(browser, "desktop", zone);
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
    const names = await productNames(page);
    check(`[catalogue ${zone}] compteur (${await count(page)}) = cartes affichées (${names.length}) = produits vendus dans la zone (${EXPECTED[zone]})`, (await count(page)) === names.length && names.length === EXPECTED[zone], `${await count(page)} / ${names.length} / ${EXPECTED[zone]}`);
    check(`[catalogue ${zone}] aucun « Non disponible dans cette zone » dans la liste`, (await page.getByText("Non disponible dans cette zone").count()) === 0);
    check(`[catalogue ${zone}] le produit sans prix nulle part est absent`, !names.includes("Produit sans aucun prix"));
    const nord = names.includes("Produit Amérique du Nord");
    const savonNoir = names.some((n) => /^Savon noir africain/.test(n));
    check(`[catalogue ${zone}] « Produit Amérique du Nord » ${zone === "bj" ? "masqué" : "visible"}, « Savon noir africain » (Bénin seul) ${zone === "bj" ? "visible" : "masqué"}`, nord === (zone !== "bj") && savonNoir === (zone === "bj"), `nord=${nord} savon=${savonNoir}`);
    const chips = await page.locator("button.shrink-0").allInnerTexts();
    check(`[catalogue ${zone}] la catégorie « Rayon Amérique du Nord » ${zone === "bj" ? "n'est pas proposée" : "est proposée"}`, chips.some((c) => /Rayon Amérique du Nord/.test(c)) === (zone !== "bj"), chips.join("|"));
    await page.getByPlaceholder("Rechercher un produit…").fill("savon noir"); await sleep(250);
    check(`[catalogue ${zone}] recherche « savon noir » : ${zone === "bj" ? "trouvé" : "introuvable (masqué)"}`, (await productNames(page)).some((n) => /Savon noir/.test(n)) === (zone === "bj"));
    await page.getByPlaceholder("Rechercher un produit…").fill("Amérique du Nord"); await sleep(250);
    check(`[catalogue ${zone}] recherche « Amérique du Nord » : ${zone === "bj" ? "introuvable (masqué)" : "trouvé"}`, (await productNames(page)).some((n) => /Amérique du Nord/.test(n)) === (zone !== "bj"));
    await page.getByPlaceholder("Rechercher un produit…").fill("Produit sans aucun prix"); await sleep(250);
    check(`[catalogue ${zone}] recherche du produit sans prix : introuvable`, (await productNames(page)).length === 0);
    check(`[catalogue ${zone}] aucune erreur console`, errors.length === 0, errors.join("||"));
    await ctx.close();
  }

  { const { ctx, page } = await open(browser, "desktop", "bj");
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(300);
    const seq = [];
    for (const z of ["ca", "us", "bj", "ca"]) { await switchZone(page, z); seq.push([z, await count(page), (await productNames(page)).length]); }
    check(`[catalogue] changements de zone sans rechargement : compteurs ${JSON.stringify(seq)}`, seq.every(([z, c, n]) => c === EXPECTED[z] && n === EXPECTED[z]));
    await switchZone(page, "bj");
    await page.goto(BASE + "/catalogue?categorie=t-cat-na", { waitUntil: "networkidle" }); await sleep(300);
    check("[catalogue] lien vers une catégorie absente de la zone (Bénin) : liste complète de la zone, pas de page vide ni d'erreur", (await count(page)) === EXPECTED.bj);
    await switchZone(page, "ca"); await sleep(250);
    check("[catalogue] …puis au Canada la catégorie du lien s'applique", (await productNames(page)).length === 1 && (await productNames(page))[0] === "Produit Amérique du Nord");
    await ctx.close(); }

  // =============== 2. Accueil : produits mis en avant, rayons phares ===============
  for (const zone of ["bj", "ca", "us"]) {
    const { ctx, page, errors } = await open(browser, "desktop", zone);
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(400);
    const featured = await page.getByTestId("home-featured").locator("a.line-clamp-2").allInnerTexts();
    const expectFeat = sql(`select name from products where featured = true and price_${zone} is not null order by sort_order, name`).split("\n").filter(Boolean);
    check(`[accueil ${zone}] produits mis en avant = produits vedettes vendus dans la zone (${expectFeat.length})`, JSON.stringify(featured.map((s) => s.trim()).sort()) === JSON.stringify(expectFeat.sort()), `${featured.length} vs ${expectFeat.length}`);
    check(`[accueil ${zone}] ni le produit sans prix, ni « Non disponible dans cette zone »`, !featured.some((n) => /sans aucun prix/.test(n)) && (await page.getByText("Non disponible dans cette zone").count()) === 0);
    const cats = await page.getByTestId("home-categories").locator("h3").allInnerTexts();
    check(`[accueil ${zone}] « Le meilleur de la maison » : rayon « Amérique du Nord » ${zone === "bj" ? "absent" : "présent"}`, cats.some((c) => /Amérique du Nord/.test(c)) === (zone !== "bj"), cats.join("|"));
    const expectCats = Number(sql(`select count(*) from categories c where c.featured_home and exists (select 1 from products p where p.category_id=c.id and p.price_${zone} is not null)`));
    check(`[accueil ${zone}] rayons phares affichés (${cats.length}) = rayons ayant un produit dans la zone (${expectCats})`, cats.length === expectCats, `${cats.length} vs ${expectCats}`);
    check(`[accueil ${zone}] aucune erreur console`, errors.length === 0, errors.join("||"));
    await ctx.close();
  }

  // =============== 3. Fiche produit : lien direct ===============
  { const { ctx, page, errors } = await open(browser, "desktop", "ca");
    const resp = await page.goto(BASE + "/produit/savon-noir-africain", { waitUntil: "networkidle" }); await sleep(500);
    check("[fiche] produit Bénin seul ouvert au Canada : page 200 (ni 500, ni page vide)", resp.status() === 200 && (await page.locator("body").innerText()).length > 100);
    const gate = page.getByTestId("zone-unavailable");
    check("[fiche] message « Non disponible dans votre zone » affiché", (await gate.count()) === 1 && /Non disponible dans votre zone/.test(await gate.innerText()));
    check("[fiche] il nomme le produit et la zone actuelle (Canada)", /Savon noir africain/.test(await gate.innerText()) && /Canada/.test(await gate.innerText()));
    check("[fiche] bouton « Passer à la zone Bénin… » et lien « Retourner à la boutique » présents, pas de bouton Canada", (await page.getByTestId("switch-zone-bj").count()) === 1 && (await page.getByTestId("switch-zone-ca").count()) === 0 && (await gate.getByRole("link", { name: "Retourner à la boutique" }).getAttribute("href")) === "/catalogue");
    check("[fiche] le bouton « Ajouter au panier » n'est pas accessible", (await page.getByRole("button", { name: /Ajouter au panier/ }).count()) === 0);
    await page.getByTestId("switch-zone-bj").click(); await sleep(400);
    check("[fiche] « Passer à la zone Bénin » : la fiche s'affiche avec son prix en FCFA et le bouton d'ajout", (await page.getByTestId("zone-unavailable").count()) === 0 && /FCFA/.test(await page.locator("main").innerText()) && (await page.getByRole("button", { name: /Ajouter au panier/ }).count()) === 1);
    check("[fiche] la zone choisie est mémorisée par le navigateur", (await page.evaluate(() => localStorage.getItem("africakani.zone"))) === "bj");
    check("[fiche] aucune erreur console", errors.length === 0, errors.join("||"));
    await ctx.close(); }
  { const { ctx, page } = await open(browser, "desktop", "bj");
    const resp = await page.goto(BASE + "/produit/t-na-only", { waitUntil: "networkidle" }); await sleep(400);
    check("[fiche] produit Amérique du Nord seul ouvert au Bénin : message + 2 boutons (Canada, États-Unis)", resp.status() === 200 && (await page.getByTestId("zone-unavailable").count()) === 1 && (await page.getByTestId("switch-zone-ca").count()) === 1 && (await page.getByTestId("switch-zone-us").count()) === 1 && (await page.getByTestId("switch-zone-bj").count()) === 0);
    await page.getByTestId("switch-zone-us").click(); await sleep(400);
    check("[fiche] « Passer à la zone États-Unis » : prix en USD affiché", /USD/.test(await page.locator("main").innerText()));
    await ctx.close(); }
  { for (const zone of ["bj", "ca"]) {
      const { ctx, page } = await open(browser, "desktop", zone);
      await page.goto(BASE + "/produit/beurre-de-karite-pur", { waitUntil: "networkidle" }); await sleep(400);
      check(`[fiche ${zone}] produit vendu dans la zone : page normale (pas de message)`, (await page.getByTestId("zone-unavailable").count()) === 0 && (await page.getByRole("button", { name: /Ajouter au panier/ }).count()) === 1);
      const rel = await page.getByTestId("related-products").locator("a[href^='/produit/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href").replace("/produit/", "")))]);
      const allSold = rel.every((slug) => sql(`select price_${zone} is not null from products where slug='${slug}'`) === "t");
      check(`[fiche ${zone}] « Vous aimerez aussi » : ${rel.length} suggestion(s), toutes vendues dans la zone, aucune « Non disponible »`, allSold && rel.length <= 4 && (await page.getByText("Non disponible dans cette zone").count()) === 0, rel.join(","));
      await ctx.close();
    }
    const { ctx, page } = await open(browser, "desktop", "ca");
    await page.goto(BASE + "/produit/t-na-only", { waitUntil: "networkidle" }); await sleep(500);
    check("[fiche] zone mémorisée (Canada) + lien direct vers un produit Amérique du Nord : fiche normale, pas de message", (await page.getByTestId("zone-unavailable").count()) === 0 && (await page.getByRole("button", { name: /Ajouter au panier/ }).count()) === 1);
    await ctx.close(); }

  { const r = await fetch(BASE + "/produit/t-nulle-part");
    check("[public] produit sans prix nulle part : réponse 404", r.status === 404, String(r.status));
    check("[public] …et son nom n'apparaît pas dans la page", !(await r.text()).includes("Produit sans aucun prix"));
    const sm = await (await fetch(BASE + "/sitemap.xml")).text();
    // Le plan du site est construit au moment du « build » : les produits de test ajoutés plus tard n'y sont pas.
    // On vérifie donc ce qui ne dépend pas d'eux : jamais le produit sans prix, tous les produits d'exemple vendus.
    check("[SEO] sitemap : le produit sans prix n'y figure pas, les produits vendus y figurent", !sm.includes("/produit/t-nulle-part") && sm.includes("/produit/beurre-de-karite-pur") && sm.includes("/produit/savon-noir-africain"));
    const nUrls = (sm.match(/\/produit\//g) || []).length;
    const seedListed = Number(sql("select count(*) from products where id not like 't-%' and (price_bj is not null or price_ca is not null or price_us is not null)"));
    check(`[SEO] sitemap : ${nUrls} fiches produit = produits d'exemple vendus quelque part (${seedListed})${nUrls === seedListed + 1 ? " + le produit de test Amérique du Nord (build fait après l'ajout)" : ""}`, nUrls === seedListed || nUrls === seedListed + 1, String(nUrls)); }
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/admin/login"); await p.locator('input[type="password"]').fill(ADMIN_PW); await p.locator('input[type="password"]').press("Enter"); await p.waitForURL(/\/admin\/?$/);
    await p.goto(BASE + "/admin/produits", { waitUntil: "networkidle" });
    const row = p.locator("tr", { hasText: "Produit sans aucun prix" });
    check("[admin] liste des produits : le produit sans prix est visible, avec « Invisible en boutique : aucun prix dans aucune zone »", (await row.count()) === 1 && /Invisible en boutique/.test(await row.innerText()));
    const savonRow = await p.locator("tr", { hasText: "Savon noir africain" }).innerText();
    check("[admin] les produits vendus affichent leurs zones (Savon noir : Afrique (FCFA) seulement)", /Afrique \(FCFA\)/.test(savonRow) && !/CA Canada/.test(savonRow));
    const r = await ctx.request.get(BASE + "/produit/t-nulle-part");
    check("[admin] connecté : la fiche du produit sans prix est consultable (200)", r.status() === 200);
    await p.goto(BASE + "/produit/t-nulle-part", { waitUntil: "networkidle" }); await sleep(400);
    check("[admin] …avec l'avertissement « invisible pour le public » et sans message de zone", (await p.getByTestId("admin-hidden-product").count()) === 1 && (await p.getByTestId("zone-unavailable").count()) === 0);
    await ctx.close(); }

  // =============== 4. Panier : jamais de produit non vendu dans la zone ===============
  async function addToCart(page, slug) {
    await page.goto(`${BASE}/produit/${slug}`, { waitUntil: "networkidle" }); await sleep(300);
    await page.getByRole("button", { name: "Ajouter au panier" }).click(); await sleep(250);
  }
  { const { ctx, page, errors } = await open(browser, "desktop", "ca");
    await addToCart(page, "beurre-de-karite-pur");
    await addToCart(page, "t-na-only");
    await page.goto(BASE + "/panier", { waitUntil: "networkidle" }); await sleep(300);
    const t0 = await page.locator("main").innerText();
    check("[panier] au Canada : 2 articles (produit commun + produit Amérique du Nord)", /Beurre de karité/.test(t0) && /Amérique du Nord/.test(t0));
    await switchZone(page, "bj"); await sleep(400);
    const notice = page.getByTestId("cart-zone-notice");
    check("[panier] passage au Bénin : message nommant le produit retiré et la zone", (await notice.count()) === 1 && /1 produit a été retiré/.test(await notice.innerText()) && /Produit Amérique du Nord/.test(await notice.innerText()) && /Bénin/.test(await notice.innerText()), await notice.innerText().catch(() => "—"));
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("africakani.cart") || "[]"));
    check("[panier] le panier mémorisé ne contient plus le produit non vendu, garde le produit commun", stored.length === 1 && stored[0].product.id === "p02", JSON.stringify(stored.map((l) => l.product.id)));
    const t1 = await page.locator("main").innerText();
    check("[panier] le total est en FCFA", /FCFA/.test(t1) && !/CAD/.test(t1));
    await switchZone(page, "ca"); await sleep(400);
    const stored2 = JSON.parse(await page.evaluate(() => localStorage.getItem("africakani.cart") || "[]"));
    check("[panier] retour au Canada : le produit retiré n'est pas rajouté tout seul", stored2.length === 1);
    await page.getByLabel("Fermer ce message").click().catch(() => {}); await sleep(200);
    check("[panier] le message se ferme", (await page.getByTestId("cart-zone-notice").count()) === 0);
    check("[panier] aucune erreur console", errors.length === 0, errors.join("||"));
    await ctx.close(); }
  { const { ctx, page } = await open(browser, "desktop", "ca");
    await addToCart(page, "t-na-only");
    await page.goto(BASE + "/panier", { waitUntil: "networkidle" }); await sleep(500);
    check("[panier] zone Canada mémorisée + produit Amérique du Nord rechargés : le produit reste (pas retiré par la zone par défaut)", /Produit Amérique du Nord/.test(await page.locator("main").innerText()) && (await page.getByTestId("cart-zone-notice").count()) === 0);
    await page.reload({ waitUntil: "networkidle" }); await sleep(500);
    check("[panier] …y compris après un second rechargement", /Produit Amérique du Nord/.test(await page.locator("main").innerText()));
    await ctx.close(); }
  { const { ctx, page } = await open(browser, "desktop", "ca");
    await addToCart(page, "t-na-only");
    await page.evaluate(() => localStorage.setItem("africakani.zone", "bj"));
    await page.goto(BASE + "/panier", { waitUntil: "networkidle" }); await sleep(500);
    check("[panier] zone mémorisée Bénin + produit Amérique du Nord dans le panier : retiré au chargement, avec message, panier vide", (await page.getByTestId("cart-zone-notice").count()) === 1 && /Votre panier est vide/.test(await page.locator("main").innerText()));
    await page.goto(BASE + "/commande", { waitUntil: "networkidle" }); await sleep(300);
    check("[commande] panier vide : page claire, pas d'erreur", /Votre panier est vide/.test(await page.locator("main").innerText()));
    await ctx.close(); }
  { const { ctx, page } = await open(browser, "desktop", "ca");
    await addToCart(page, "beurre-de-karite-pur"); await addToCart(page, "t-na-only");
    await page.goto(BASE + "/commande", { waitUntil: "networkidle" }); await sleep(400);
    await page.locator("main form").getByRole("button", { name: "Afrique (FCFA)" }).click(); await sleep(400);
    const recap = await page.locator("main").innerText();
    check("[commande] changement de zone sur la page de commande : produit non vendu retiré du récapitulatif, message visible", (await page.getByTestId("cart-zone-notice").count()) === 1 && !/1 × Produit Amérique du Nord/.test(recap) && /1 × Beurre de karité/.test(recap));
    await ctx.close(); }

  // =============== 5. Hors ligne et zone mémorisée ===============
  { const { ctx, page, errors } = await open(browser, "desktop", "bj");
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
    await ctx.setOffline(true);
    await switchZone(page, "us"); await sleep(300);
    check("[hors ligne] changement de zone sans connexion : la liste suit (compteur & cartes cohérents)", (await count(page)) === EXPECTED.us && (await productNames(page)).length === EXPECTED.us);
    check("[hors ligne] la zone est mémorisée par le navigateur", (await page.evaluate(() => localStorage.getItem("africakani.zone"))) === "us");
    await ctx.setOffline(false);
    await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(500);
    check("[retour en ligne] la zone mémorisée (États-Unis) est reprise au chargement", (await count(page)) === EXPECTED.us);
    check("[hors ligne] aucune erreur console imprévue", errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|net::/.test(e)).length === 0, errors.join("||"));
    await ctx.close(); }
  { const c1 = await browser.newContext({ ...SIZES.desktop, serviceWorkers: "block" });
    await c1.addInitScript(() => { try { localStorage.setItem("africakani.zone", "zz-invalide"); } catch {} });
    const p1 = await c1.newPage();
    await p1.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
    check("[zone mémorisée invalide] retombe sur la zone par défaut (Bénin)", (await count(p1)) === EXPECTED.bj);
    await c1.close();
    const c2 = await browser.newContext({ ...SIZES.desktop, serviceWorkers: "block" });
    await c2.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("stockage indisponible"); } }); });
    const p2 = await c2.newPage(); const errs = []; p2.on("pageerror", (e) => errs.push(String(e)));
    await p2.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
    check("[stockage indisponible] le catalogue s'affiche quand même (zone par défaut), sans planter", (await count(p2)) === EXPECTED.bj && errs.length === 0, errs.join("||"));
    await c2.close(); }

  // =============== 6. Commande : adresse ↔ zone, tous les modes de paiement ===============
  const EMAIL = "zone.test@example.com";
  const orderRows = () => Number(sql(`select count(*) from orders where customer_email='${EMAIL}'`));
  const lastOrder = () => { const r = sql(`select id, zone_id, customer_country, payment_method from orders where customer_email='${EMAIL}' order by created_at desc limit 1`); if (!r) return null; const [id, zone, country, method] = r.split("|"); return { id, zone, country, method }; };
  async function fillForm(page, { zone, country, mm }) {
    const form = page.locator("main form").first();
    await form.locator('input[type="text"]').nth(0).fill("Client Zone");
    await form.locator('input[type="tel"]').first().fill("+22997000000");
    await form.locator('input[type="email"]').fill(EMAIL);
    const na = zone !== "bj";
    const inLabel = async (t, v) => { const l = form.locator("label", { hasText: t }).locator("input").first(); if (await l.count()) await l.fill(v); };
    await inLabel(na ? "Numéro et rue" : "Adresse de livraison", na ? "200 Rue Test" : "Rue 12, Cotonou");
    await inLabel("Ville", "Ville");
    if (na) { await inLabel("Province", zone === "ca" ? "QC" : "NY"); await inLabel("Code postal", zone === "ca" ? "H2X 1Y5" : "10001"); }
    if (country) await form.locator("label", { hasText: "Pays" }).locator("select").selectOption(country);
    if (mm) {
      await form.getByRole("button", { name: "Mobile Money", exact: true }).click(); await sleep(300);
      await form.locator('input[type="tel"]').nth(1).fill("97111111");
      await form.locator("label", { hasText: "Identifiant de transaction" }).locator("input").fill("TXZONE" + Date.now());
    }
  }
  // `tamper` réécrit la demande avant son départ : le navigateur ne fait pas foi.
  async function submit(page, { pay, tamper }) {
    const form = page.locator("main form").first();
    if (pay === "stripe") await form.locator("button:has-text('Payer par carte')").click();
    if (pay === "paypal") await form.locator("button:has-text('PayPal')").first().click();
    await page.route("**/commande", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
      let body = req.postData();
      try { const arr = JSON.parse(body); if (tamper) tamper(arr[0]); body = JSON.stringify(arr); } catch { /* corps non JSON */ }
      return route.continue({ postData: body });
    });
    await form.locator('button[type="submit"]').click();
    const outcome = await Promise.race([
      page.waitForURL(/checkout\.stripe\.com|sandbox\.paypal\.com/, { timeout: 12000 }).then(() => "redirect"),
      page.locator("p.bg-red-50").first().waitFor({ timeout: 12000 }).then(() => "error"),
      page.getByText(/Merci,/).first().waitFor({ timeout: 12000 }).then(() => "confirmed"),
    ]).catch(() => "timeout");
    const error = outcome === "error" ? (await page.locator("p.bg-red-50").first().innerText()).trim() : "";
    await page.unroute("**/commande");
    return { outcome, error };
  }
  async function newCheckout(browser, size, zone) {
    const h = await open(browser, size, zone);
    await h.page.route(/checkout\.stripe\.com|sandbox\.paypal\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>page du fournisseur de paiement</h1>" }));
    await addToCart(h.page, "beurre-de-karite-pur");
    await h.page.goto(`${BASE}/commande`, { waitUntil: "networkidle" }); await sleep(600);
    return h;
  }

  for (const [zone, expected] of [["bj", ["Bénin", "Togo", "Burkina Faso", "Côte d'Ivoire", "Mali", "Niger", "Sénégal", "Guinée-Bissau"]], ["ca", ["Canada"]], ["us", ["États-Unis"]]]) {
    const { ctx, page } = await newCheckout(browser, "desktop", zone);
    const opts = await page.locator("main form label", { hasText: "Pays" }).locator("select option").allInnerTexts();
    check(`[formulaire ${zone}] liste de pays limitée à la zone : ${expected.join(", ")}`, JSON.stringify(opts) === JSON.stringify(expected), opts.join("|"));
    check(`[formulaire ${zone}] plus de champ pays libre`, (await page.locator("main form label", { hasText: "Pays" }).locator("input").count()) === 0);
    await ctx.close();
  }
  { const { ctx, page } = await newCheckout(browser, "desktop", "ca");
    await page.locator("main form").getByRole("button", { name: "Afrique (FCFA)" }).click(); await sleep(400);
    const sel = page.locator("main form label", { hasText: "Pays" }).locator("select");
    check("[formulaire] Canada → Bénin : la liste passe à 8 pays et « Bénin » est choisi par défaut", (await sel.locator("option").count()) === 8 && (await sel.inputValue()) === "Bénin");
    await sel.selectOption("Togo"); await page.locator("main form").getByRole("button", { name: "CA Canada" }).click(); await sleep(300);
    check("[formulaire] retour au Canada : « Canada » (le Togo n'est plus proposé)", (await sel.inputValue()) === "Canada");
    await ctx.close(); }

  const MODES = [
    { name: "WhatsApp (Bénin)", zone: "bj", pay: null, coherent: "Bénin", other: ["Canada", "États-Unis"] },
    { name: "WhatsApp (Canada)", zone: "ca", pay: null, coherent: "Canada", other: ["États-Unis", "Bénin"] },
    { name: "Mobile Money (Bénin)", zone: "bj", pay: null, mm: true, coherent: "Bénin", other: ["Canada"] },
    { name: "Stripe (Canada)", zone: "ca", pay: "stripe", coherent: "Canada", other: ["États-Unis", "Bénin"], redirect: true },
    { name: "PayPal (États-Unis)", zone: "us", pay: "paypal", coherent: "États-Unis", other: ["Canada", "Bénin"], redirect: true },
  ];
  for (const m of MODES) {
    for (const bad of [...m.other, "France", "", "Nigeria"]) {
      const { ctx, page } = await newCheckout(browser, "desktop", m.zone);
      await fillForm(page, { zone: m.zone, country: m.coherent, mm: m.mm });
      const before = orderRows(), payBefore = payments();
      const r = await submit(page, { pay: m.pay, tamper: (d) => { d.customer.country = bad; } });
      const clear = bad === "" ? /pays de livraison/ : bad === "France" || bad === "Nigeria" ? /ne livrons pas encore/ : /zone de livraison choisie/;
      check(`[${m.name}] adresse en « ${bad || "(vide)"} » : refusée avec un message clair en français`, r.outcome === "error" && clear.test(r.error), `${r.outcome} ${r.error}`);
      check(`[${m.name}] …aucune commande créée, aucun appel au fournisseur de paiement`, orderRows() === before && payments() === payBefore, `commandes ${before}→${orderRows()}, paiements ${payBefore}→${payments()}`);
      await ctx.close();
    }
    const { ctx, page } = await newCheckout(browser, "desktop", m.zone);
    await fillForm(page, { zone: m.zone, country: m.coherent, mm: m.mm });
    const before = orderRows();
    const r = await submit(page, { pay: m.pay });
    const okOutcome = m.redirect ? r.outcome === "redirect" : r.outcome === "confirmed";
    check(`[${m.name}] adresse cohérente (${m.coherent}) : acceptée (${m.redirect ? "redirection vers le paiement" : "commande confirmée"})`, okOutcome, `${r.outcome} ${r.error}`);
    const o = lastOrder();
    check(`[${m.name}] commande enregistrée avec la bonne zone, le bon pays et le bon mode`, orderRows() === before + 1 && o && o.zone === m.zone && o.country === m.coherent && (m.pay ? o.method === m.pay : m.mm ? o.method === "mobile_money" : !o.method || o.method === "whatsapp"), JSON.stringify(o));
    await ctx.close();
  }
  { const { ctx, page } = await newCheckout(browser, "desktop", "bj");
    await fillForm(page, { zone: "bj", country: "Togo" });
    const r = await submit(page, { pay: null });
    check("[WhatsApp (Bénin)] pays « Togo » (zone Afrique de l'Ouest) : accepté et enregistré", r.outcome === "confirmed" && lastOrder()?.country === "Togo", `${r.outcome} ${r.error} ${JSON.stringify(lastOrder())}`);
    await ctx.close(); }
  { const { ctx, page } = await newCheckout(browser, "desktop", "us");
    await fillForm(page, { zone: "us", country: "États-Unis" });
    const r = await submit(page, { pay: null, tamper: (d) => { d.customer.country = "usa"; } });
    check("[WhatsApp (États-Unis)] « usa » : accepté et enregistré sous « États-Unis »", r.outcome === "confirmed" && lastOrder()?.country === "États-Unis", `${r.outcome} ${r.error} ${JSON.stringify(lastOrder())}`);
    await ctx.close(); }
  { const { ctx, page } = await newCheckout(browser, "desktop", "ca");
    await fillForm(page, { zone: "ca", country: "Canada" });
    const before = orderRows();
    const r = await submit(page, { pay: null, tamper: (d) => { d.zoneId = "bj"; } });
    check("[sécurité] zone changée en Bénin sur une adresse canadienne : refusée", r.outcome === "error" && orderRows() === before, `${r.outcome} ${r.error}`);
    await ctx.close(); }

  // =============== 7. Mobile et tablette : 320, 375, 768, 1280 ===============
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    { const { ctx, page, errors } = await open(browser, size, "ca");
      await page.goto(BASE + "/catalogue", { waitUntil: "networkidle" }); await sleep(400);
      check(`[${w}px] catalogue Canada : compteur = cartes (${EXPECTED.ca}), sans débordement, sans erreur`, (await count(page)) === EXPECTED.ca && (await productNames(page)).length === EXPECTED.ca && (await noOverflow(page)) && errors.length === 0, errors.join("||"));
      await page.goto(BASE + "/produit/savon-noir-africain", { waitUntil: "networkidle" }); await sleep(500);
      const gate = page.getByTestId("zone-unavailable");
      const box = await gate.boundingBox();
      check(`[${w}px] « Non disponible dans votre zone » : message dans l'écran, boutons ≥ 44 px, sans débordement`, !!box && box.x >= 0 && box.x + box.width <= w + 0.5 && (await noOverflow(page)) && (await gate.locator("button, a").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 44))));
      await page.screenshot({ path: `${OUT}/zone-indisponible-${w}.png` });
      await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(400);
      check(`[${w}px] accueil Canada : sans débordement`, await noOverflow(page));
      await ctx.close(); }
    { const { ctx, page } = await open(browser, size, "ca");
      await addToCart(page, "beurre-de-karite-pur"); await addToCart(page, "t-na-only");
      await page.goto(BASE + "/panier", { waitUntil: "networkidle" }); await sleep(300);
      await page.evaluate(() => { localStorage.setItem("africakani.zone", "bj"); });
      await page.reload({ waitUntil: "networkidle" }); await sleep(500);
      const n = page.getByTestId("cart-zone-notice");
      const nb = await n.boundingBox().catch(() => null);
      check(`[${w}px] panier : message de produit retiré visible et dans l'écran`, (await n.count()) === 1 && !!nb && nb.x >= 0 && nb.x + nb.width <= w + 0.5);
      if (!(await noOverflow(page))) info(`[${w}px] (existant, hors chantier) la page panier déborde de l'écran : ligne d'article trop large`);
      await page.screenshot({ path: `${OUT}/zone-panier-notice-${w}.png` });
      await ctx.close(); }
    { const { ctx, page } = await newCheckout(browser, size, "bj");
      const sel = page.locator("main form label", { hasText: "Pays" }).locator("select");
      const b = await sel.boundingBox();
      check(`[${w}px] commande : liste « Pays » dans l'écran, utilisable (≥ 40 px), sans débordement`, !!b && b.x >= 0 && b.x + b.width <= w + 0.5 && b.height >= 40 && (await noOverflow(page)));
      await sel.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/zone-commande-pays-${w}.png` });
      await ctx.close(); }
  }

  await browser.close();
  finish();
})();
