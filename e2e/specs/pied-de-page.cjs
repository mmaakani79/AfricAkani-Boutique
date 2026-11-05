// Pied de page du site : l'adresse du fournisseur est « Québec, Canada » dans le bloc Contact ET dans le bloc
// « Le cœur de l'opération » ; plus aucun « Cotonou » dans le pied de page ; mobile et ordinateur, hors ligne.
const { BASE, SIZES, check, sleep, finish, launch, noOverflow } = require("../lib/common.cjs");

(async () => {
  const browser = await launch();
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
    await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 404, body: "" }));
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(300);
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    const text = (await footer.innerText()).replace(/\s+/g, " ");
    check(`[pied ${w}px] le bloc « Le cœur de l'opération » donne « Québec, Canada »`, /Le cœur de l’opération Québec, Canada/.test(text), text.slice(0, 600));
    check(`[pied ${w}px] « Québec, Canada » apparaît deux fois (Contact et cœur de l'opération), plus aucun « Cotonou »`, text.split("Québec, Canada").length - 1 === 2 && !text.includes("Cotonou"), text.slice(0, 600));
    check(`[pied ${w}px] WhatsApp +1 514 867 3738 et courriel inchangés, aucun débordement, aucune erreur`, text.includes("WhatsApp +1 514 867 3738") && text.includes("contact@africakani.com") && (await noOverflow(page)) && errors.length === 0, errors.join("||"));
    if (size === "mobile375") {
      await ctx.setOffline(true);
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      check("[pied hors ligne] la page déjà chargée reste affichée avec son pied de page", (await footer.innerText()).includes("Québec, Canada"));
      await ctx.setOffline(false);
    }
    await ctx.close();
  }
  await browser.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
