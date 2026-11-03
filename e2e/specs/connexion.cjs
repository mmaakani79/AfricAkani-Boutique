// Connexion à l'administration : mot de passe faux et bon, messages, mobile, hors ligne.
// (En local ce n'est pas un Preview Vercel : l'indication « Preview » du message n'apparaît pas ici ;
// elle est vérifiée par les tests unitaires.)
const { BASE, ADMIN_PW, SIZES, check, sleep, finish, launch, noOverflow } = require("../lib/common.cjs");

(async () => {
  const browser = await launch();
  for (const size of ["mobile320", "mobile375", "tablet768", "desktop"]) {
    const w = SIZES[size].viewport.width;
    const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
    await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 404, body: "" }));
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    check(`[${w}px] page de connexion affichée, sans débordement`, (await page.locator('input[type="password"]').count()) === 1 && (await noOverflow(page)));

    await page.locator('input[type="password"]').fill("un-mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.getByText("Mot de passe incorrect.").waitFor({ timeout: 15000 });
    check(`[${w}px] mauvais mot de passe : « Mot de passe incorrect. », on reste sur la page de connexion`, page.url().endsWith("/admin/login"));
    check(`[${w}px] le cookie de session n'est pas posé après un refus`, !(await ctx.cookies()).some((c) => c.name === "africakani_admin_session"));

    if (size === "mobile375") {
      await ctx.setOffline(true);
      await page.locator('input[type="password"]').fill(ADMIN_PW);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await sleep(2500);
      const shown = await page.getByText("Connexion impossible").count();
      check(`[${w}px] hors ligne : message clair, aucune session ouverte, on reste sur la page`, shown === 1 && page.url().endsWith("/admin/login") && !(await ctx.cookies()).some((c) => c.name === "africakani_admin_session"));
      await ctx.setOffline(false);
      await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    }

    await page.locator('input[type="password"]').fill(ADMIN_PW);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
    check(`[${w}px] bon mot de passe : tableau de bord de l'administration`, /Tableau de bord/.test(await page.locator("body").innerText()) && (await ctx.cookies()).some((c) => c.name === "africakani_admin_session"));
    check(`[${w}px] aucune erreur de page (hors tentative sans réseau)`, errors.filter((e) => !/fetch|network|Failed/i.test(e)).length === 0, errors.join("||"));
    await ctx.close();
  }
  await browser.close();
  finish();
})();
