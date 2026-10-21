// Pages légales : texte identique au texte validé, liens (pied de page, commande),
// plan du site, 320 / 375 / 768 / 1280 px, trois zones, en ligne et hors ligne.
const fs = require("fs");
const path = require("path");
const { BASE, OUT, SIZES, check, info, sleep, finish, sql, launch, noOverflow } = require("../lib/common.cjs");

const PAGES = [
  { n: 1, title: "Mentions légales", path: "/mentions-legales" },
  { n: 2, title: "Politique de confidentialité", path: "/confidentialite" },
  { n: 3, title: "Conditions de vente", path: "/conditions-de-vente" },
  { n: 4, title: "Livraison et retours", path: "/livraison-retours" },
];
const ZONE_BTN = { bj: "Afrique (FCFA)", ca: "CA Canada", us: "US États-Unis" };

// ---- Ce que chaque page doit afficher : le fichier du texte validé, ligne par ligne --------------
const SOURCE = fs.readFileSync(path.join(__dirname, "../../tests/fixtures/pages-legales.md"), "utf8");
function expectedLines(n) {
  const start = SOURCE.indexOf(`=== PAGE ${n} `);
  const end = SOURCE.indexOf("\n=== ", start + 5);
  const body = SOURCE.slice(SOURCE.indexOf("\n", start) + 1, end === -1 ? undefined : end).split("\n");
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line.trim() === "") continue;
    const shown = line.replace(/^- /, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
    out.push(shown);
  }
  return out;
}

// Contraste WCAG calculé sur les couleurs réellement affichées : le navigateur lui-même convertit
// la couleur (quel que soit son format) en pixel posé sur le fond blanc de la carte.
const contrastOf = (page, selector) =>
  page.evaluate((sel) => {
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const cx = canvas.getContext("2d", { willReadFrequently: true });
    const onWhite = (color) => {
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, 1, 1);
      cx.fillStyle = color; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const l2 = lum([255, 255, 255]);
    const ratios = [...document.querySelectorAll(sel)].map((el) => {
      const l1 = lum(onWhite(getComputedStyle(el).color));
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });
    return Math.min(...ratios);
  }, selector);

async function open(browser, size, zone) {
  const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
  // Les statistiques n'existent pas hors de Vercel : on bloque leur script, sans effet sur la page.
  await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 404, body: "" }));
  if (zone) await ctx.addInitScript((z) => { try { if (!localStorage.getItem("africakani.zone")) localStorage.setItem("africakani.zone", z); } catch {} }, zone);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}

(async () => {
  const browser = await launch();

  // ===== 1. Chaque page : texte identique, titre, liens, lisibilité, 4 largeurs =====
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const { ctx, page, errors } = await open(browser, size);
    for (const p of PAGES) {
      const resp = await page.goto(BASE + p.path, { waitUntil: "networkidle" });
      const tag = `[${w}px ${p.path}]`;
      check(`${tag} la page répond (200) et affiche le titre « ${p.title} »`, resp.status() === 200 && (await page.locator("h1").innerText()).trim() === p.title, String(resp.status()));
      if (size === "desktop") {
        const meta = await page.evaluate(() => ({ title: document.title, canonical: document.querySelector('link[rel="canonical"]')?.href, desc: document.querySelector('meta[name="description"]')?.content, robots: document.querySelector('meta[name="robots"]')?.content || null }));
        check(`${tag} titre de l'onglet, adresse canonique et description présents, page indexable`, meta.title === `${p.title} — AfricAkani` && meta.canonical === BASE + p.path && !!meta.desc && !/noindex/.test(meta.robots || ""), JSON.stringify(meta));
      }
      // texte : titres, paragraphes, puces, dans l'ordre, tels quels
      const shown = await page.evaluate(() => [...document.querySelectorAll('[data-testid="legal-document"] > *')].flatMap((el) => el.tagName === "UL" ? [...el.querySelectorAll("li")].map((li) => li.innerText.trim()) : [el.innerText.trim()]));
      const expected = [p.title, ...expectedLines(p.n)];
      check(`${tag} le texte affiché est exactement le texte validé (${expected.length} blocs, même ordre)`, JSON.stringify(shown) === JSON.stringify(expected), shown.filter((s, i) => s !== expected[i]).slice(0, 2).join(" ≠ "));
      const bodyText = await page.locator('[data-testid="legal-document"]').innerText();
      check(`${tag} aucun numéro 514…, aucune ligne « Téléphone »`, !/514[\s.\- ]*867|\(514\)/.test(bodyText) && !/t[ée]l[ée]phone\s*:/i.test(bodyText));
      check(`${tag} numéro WhatsApp +229 01 62 33 33 35 ${p.n === 3 ? "présent (conditions de vente)" : "absent"}`, bodyText.includes("+229 01 62 33 33 35") === (p.n === 3));
      const links = await page.evaluate(() => [...document.querySelectorAll('[data-testid="legal-document"] a')].map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
      if (p.n === 1) {
        check(`${tag} lien du site vers https://www.africakani.com (nouvel onglet, sécurisé) et courriels cliquables`, links.some(([t, h, tg, r]) => t === "www.africakani.com" && h === "https://www.africakani.com" && tg === "_blank" && /noopener/.test(r || "")) && links.filter(([, h]) => h === "mailto:info@africakani.com").length === 2, JSON.stringify(links));
      }
      check(`${tag} aucun débordement horizontal, texte entièrement dans l'écran`, (await noOverflow(page)) && (await page.evaluate((vw) => [...document.querySelectorAll('[data-testid="legal-document"] *')].every((el) => el.getBoundingClientRect().right <= vw + 0.5), w)));
      const fontPx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-testid="legal-document"] p, [data-testid="legal-document"] li')).fontSize));
      check(`${tag} texte lisible (≥ 14 px)`, fontPx >= 14, String(fontPx));
      if (size === "desktop" || size === "mobile320") {
        const c = await contrastOf(page, '[data-testid="legal-document"] p, [data-testid="legal-document"] li, [data-testid="legal-document"] h1, [data-testid="legal-document"] h2, [data-testid="legal-document"] a');
        check(`${tag} contraste du texte ≥ 4,5 : 1 (mesuré : ${c.toFixed(1)})`, c >= 4.5, c.toFixed(2));
        await page.screenshot({ path: `${OUT}/legal${p.path.replace("/", "-")}-${w}.png`, fullPage: true });
      }
    }
    check(`[${w}px] aucune erreur dans la console sur les 4 pages`, errors.length === 0, errors.join("||"));
    await ctx.close();
  }

  // ===== 2. Pied de page : 4 liens visibles dans les trois zones, sur plusieurs pages =====
  for (const size of ["mobile320", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const { ctx, page, errors } = await open(browser, size);
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(300);
    for (const zone of ["bj", "ca", "us"]) {
      await page.locator("header [role=group]:visible").getByRole("button", { name: ZONE_BTN[zone] }).click(); await sleep(350);
      const nav = page.getByTestId("footer-legal-links");
      await nav.scrollIntoViewIfNeeded();
      const items = await nav.locator("a").evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { text: a.textContent.trim(), href: a.getAttribute("href"), visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none", height: r.height, inScreen: r.left >= 0 && r.right <= window.innerWidth + 0.5 }; }));
      check(`[${w}px zone ${zone}] pied de page : 4 liens, dans l'ordre, visibles et dans l'écran`, items.length === 4 && items.every((i, k) => i.visible && i.inScreen && i.text === PAGES[k].title && i.href === PAGES[k].path), JSON.stringify(items));
      check(`[${w}px zone ${zone}] liens faciles à toucher (hauteur ≥ 24 px)`, items.every((i) => i.height >= 24), JSON.stringify(items.map((i) => i.height)));
    }
    check(`[${w}px] pied de page sans débordement`, await noOverflow(page));
    for (const route of ["/catalogue", "/panier", "/services", "/produit/beurre-de-karite-pur", "/notre-histoire"]) {
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      const hrefs = await page.getByTestId("footer-legal-links").locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      check(`[${w}px] ${route} : le pied de page propose les 4 pages légales`, JSON.stringify(hrefs) === JSON.stringify(PAGES.map((p) => p.path)), JSON.stringify(hrefs));
    }
    if (size === "mobile320") await page.screenshot({ path: `${OUT}/legal-pied-de-page-320.png` });
    // On clique vraiment, puis retour arrière
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    for (const p of PAGES) {
      await page.getByTestId("footer-legal-links").getByRole("link", { name: p.title, exact: true }).click();
      await page.waitForURL(`**${p.path}`);
      check(`[${w}px] clic « ${p.title} » depuis le pied de page : la page s'affiche`, (await page.locator("h1").innerText()).trim() === p.title);
      await page.goBack(); await page.waitForURL(BASE + "/");
    }
    check(`[${w}px] aucune erreur dans la console`, errors.length === 0, errors.join("||"));
    await ctx.close();
  }

  // ===== 3. Plan du site et robots =====
  { const sm = await (await fetch(BASE + "/sitemap.xml")).text();
    check("[plan du site] les 4 pages légales y figurent", PAGES.every((p) => sm.includes(`<loc>${BASE}${p.path}</loc>`)), sm.slice(0, 300));
    check("[plan du site] les pages existantes (accueil, catalogue, services, produits) y sont toujours", ["/catalogue", "/services", "/notre-histoire", "/produit/beurre-de-karite-pur"].every((p) => sm.includes(p)));
    const robots = await (await fetch(BASE + "/robots.txt")).text();
    check("[robots.txt] les pages légales ne sont pas interdites aux moteurs de recherche", !/Disallow:\s*\/(mentions|confidentialite|conditions|livraison)/.test(robots)); }

  // ===== 4. Page de commande : deux liens près du bouton, sans toucher au paiement =====
  async function addAndOpenCheckout(page, zone) {
    await page.goto(BASE + "/produit/beurre-de-karite-pur", { waitUntil: "networkidle" }); await sleep(300);
    await page.getByRole("button", { name: "Ajouter au panier" }).click(); await sleep(250);
    await page.goto(BASE + "/commande", { waitUntil: "networkidle" }); await sleep(600);
  }
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    for (const zone of ["bj", "ca", "us"]) {
      if (size !== "desktop" && size !== "mobile320" && zone !== "bj") continue;
      const { ctx, page, errors } = await open(browser, size, zone);
      await page.route(/checkout\.stripe\.com|sandbox\.paypal\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>page du fournisseur de paiement</h1>" }));
      await addAndOpenCheckout(page, zone);
      const block = page.getByTestId("order-legal-links");
      const submit = page.locator('main form button[type="submit"]');
      const bb = await block.boundingBox(), sb = await submit.boundingBox();
      check(`[${w}px zone ${zone}] commande : liens « Conditions de vente » et « Politique de confidentialité » juste sous le bouton, dans l'écran`, !!bb && !!sb && bb.y >= sb.y + sb.height - 1 && bb.y - (sb.y + sb.height) < 40 && bb.x >= 0 && bb.x + bb.width <= w + 0.5 && (await noOverflow(page)), JSON.stringify({ bb, sb }));
      const hrefs = await block.locator("a").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
      check(`[${w}px zone ${zone}] les deux liens pointent vers les bonnes pages, dans un nouvel onglet sécurisé`, JSON.stringify(hrefs) === JSON.stringify([["Conditions de vente", "/conditions-de-vente", "_blank", "noopener noreferrer"], ["Politique de confidentialité", "/confidentialite", "_blank", "noopener noreferrer"]]), JSON.stringify(hrefs));
      if (size === "desktop" || size === "mobile320") {
        // On tape dans le formulaire, on ouvre un lien : le formulaire n'est ni quitté ni vidé, la page s'ouvre à part.
        const name = page.locator('main form input[type="text"]').first();
        await name.fill("Client Liens");
        const [popup] = await Promise.all([page.context().waitForEvent("page"), block.getByRole("link", { name: "Conditions de vente" }).click()]);
        await popup.waitForLoadState("networkidle");
        check(`[${w}px zone ${zone}] le lien s'ouvre dans un autre onglet (conditions de vente), le formulaire reste intact`, popup.url().endsWith("/conditions-de-vente") && (await popup.locator("h1").innerText()).trim() === "Conditions de vente" && page.url().endsWith("/commande") && (await name.inputValue()) === "Client Liens");
        await popup.close();
        await page.screenshot({ path: `${OUT}/legal-commande-${zone}-${w}.png`, fullPage: true });
      }
      check(`[${w}px zone ${zone}] commande : aucune erreur dans la console`, errors.length === 0, errors.join("||"));
      await ctx.close();
    }
  }
  // Le bouton de paiement fonctionne toujours (Canada : carte ; États-Unis : PayPal ; Bénin : commande)
  { const EMAIL = "legal.test@example.com";
    const orders = () => Number(sql(`select count(*) from orders where customer_email='${EMAIL}'`));
    for (const [zone, pay] of [["bj", null], ["ca", "stripe"], ["us", "paypal"]]) {
      const { ctx, page } = await open(browser, "mobile375", zone);
      await page.route(/checkout\.stripe\.com|sandbox\.paypal\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>page du fournisseur de paiement</h1>" }));
      await addAndOpenCheckout(page, zone);
      const form = page.locator("main form").first();
      await form.locator('input[type="text"]').nth(0).fill("Client Liens");
      await form.locator('input[type="tel"]').first().fill("+22997000000");
      await form.locator('input[type="email"]').fill(EMAIL);
      const na = zone !== "bj";
      const fill = async (t, v) => { const l = form.locator("label", { hasText: t }).locator("input").first(); if (await l.count()) await l.fill(v); };
      await fill(na ? "Numéro et rue" : "Adresse de livraison", na ? "200 Rue Test" : "Rue 12, Cotonou");
      await fill("Ville", "Ville");
      if (na) { await fill("Province", zone === "ca" ? "QC" : "NY"); await fill("Code postal", zone === "ca" ? "H2X 1Y5" : "10001"); }
      if (pay === "stripe") await form.locator("button:has-text('Payer par carte')").click();
      if (pay === "paypal") await form.locator("button:has-text('PayPal')").first().click();
      const before = orders();
      await form.locator('button[type="submit"]').click();
      const outcome = await Promise.race([
        page.waitForURL(/checkout\.stripe\.com|sandbox\.paypal\.com/, { timeout: 15000 }).then(() => "redirect"),
        page.getByText(/Merci,/).first().waitFor({ timeout: 15000 }).then(() => "confirmed"),
        page.locator("p.bg-red-50").first().waitFor({ timeout: 15000 }).then(() => "error"),
      ]).catch(() => "timeout");
      check(`[paiement zone ${zone}] la commande ${pay ? "part vers " + pay : "est confirmée"} comme avant, une commande enregistrée`, outcome === (pay ? "redirect" : "confirmed") && orders() === before + 1, `${outcome} ${orders()}`);
      await ctx.close();
    } }

  // ===== 5. Hors ligne =====
  // Le site n'a pas de mode hors ligne complet (pas de service worker) : une page déjà chargée continue de
  // naviguer dans le site grâce aux pages préchargées. Les pages légales doivent se comporter comme /services.
  async function offlineNav(label, href, linkName, scrollFirst) {
    const { ctx, page } = await open(browser, "mobile375");
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(500);
    if (scrollFirst) { await page.getByTestId("footer-legal-links").scrollIntoViewIfNeeded(); await sleep(1500); } // le visiteur descend au pied de page en ligne : les liens sont préchargés
    await ctx.setOffline(true);
    if (!scrollFirst) await page.getByTestId("footer-legal-links").scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: linkName, exact: true }).first().click().catch(() => {});
    await sleep(1500);
    const ok = new URL(page.url()).pathname === href && (await page.locator("h1").first().innerText().catch(() => "")).length > 0;
    await ctx.close();
    return ok;
  }
  for (const p of PAGES) {
    check(`[hors ligne] ${p.title} : page ouverte depuis le pied de page, connexion coupée après le passage en bas de page`, await offlineNav(p.title, p.path, p.title, true));
  }
  { const legalCold = await offlineNav("", "/mentions-legales", "Mentions légales", false);
    const servicesCold = await offlineNav("", "/services", "Nos services", false);
    check(`[hors ligne] connexion coupée avant même de descendre en bas : les pages légales se comportent comme « Nos services » (${servicesCold ? "ouverte" : "non ouverte"} / ${legalCold ? "ouverte" : "non ouverte"})`, legalCold === servicesCold);
    info(`hors ligne, sans passage préalable en bas de page : « Nos services » ${servicesCold ? "s'ouvre" : "ne s'ouvre pas"}, « Mentions légales » ${legalCold ? "s'ouvre" : "ne s'ouvre pas"}`); }
  { // page déjà visitée, puis retour en arrière hors ligne : même comportement que « Nos services »
    async function backOffline(route) {
      const { ctx, page } = await open(browser, "mobile375");
      await page.goto(BASE + route, { waitUntil: "networkidle" }); await sleep(300);
      await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(300);
      await ctx.setOffline(true);
      await page.goBack().catch(() => {}); await sleep(1200);
      const ok = new URL(page.url()).pathname === route && (await page.locator("h1").first().innerText().catch(() => "")).trim().length > 0;
      await ctx.close();
      return ok;
    }
    const legalBack = await backOffline("/livraison-retours");
    const servicesBack = await backOffline("/services");
    info(`hors ligne, retour en arrière (chargement complet de page) : « Livraison et retours » ${legalBack ? "réapparaît" : "ne réapparaît pas"}, « Nos services » ${servicesBack ? "réapparaît" : "ne réapparaît pas"}`);
    check("[hors ligne] retour en arrière sur une page déjà vue : même comportement que le reste du site (« Nos services »)", legalBack === servicesBack || legalBack); }

  // ===== 6. Rien d'autre n'a bougé =====
  { const ctx = await browser.newContext({ ...SIZES.desktop, serviceWorkers: "block" });
    const p = await ctx.newPage();
    const r = await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    check("[admin] la page de connexion répond toujours (200) ; le pied de page commun, déjà présent dans l'admin, affiche les mêmes liens", r.status() === 200 && (await p.getByTestId("footer-legal-links").locator("a").count()) === 4);
    const guard = await fetch(BASE + "/admin/produits", { redirect: "manual" });
    check("[admin] une page d'administration sans connexion redirige toujours vers la connexion", guard.status >= 300 && guard.status < 400 && (guard.headers.get("location") || "").includes("/admin/login"), `${guard.status}`);
    const r404 = await fetch(BASE + "/mentions-legales/inexistant");
    check("[adresses] une adresse inexistante sous une page légale répond 404", r404.status === 404, String(r404.status));
    await ctx.close(); }

  await browser.close();
  finish();
})();
