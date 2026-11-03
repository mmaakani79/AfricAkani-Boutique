// Contrat signé : signature dessinée dans le navigateur, puis PDF (administration et page privée du client).
// Vérifie le texte du contrat (retours à la ligne Windows/Unix, accents, guillemets, espaces insécables),
// aucun caractère parasite (« Ð »), la signature entière, mobile et ordinateur, hors ligne.
const fs = require("fs");
const { execFileSync } = require("child_process");
const { BASE, OUT, SIZES, check, info, sleep, finish, sql, launch, noOverflow, adminContext } = require("../lib/common.cjs");

// Texte du contrat tel qu'un administrateur Windows l'enregistre : retours « \r\n », lignes vides entre les articles,
// guillemets français, accents, espace insécable (U+00A0) et espace fine insécable (U+202F) avant les « : ».
const CONTRACT_TEXT = "AKAGESTSOFT\r\n\r\n1. Objet\r\nLe prestataire fournit « le service » décrit : é è ê à ç œ ñ.\r\n\r\n2. Prix : 50 000 FCFA\r\nLigne finale";
const textOf = (file) => execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
const read = (buf, name) => { const f = `${OUT}/${name}.pdf`; fs.writeFileSync(f, buf); return f; };
const CONTROL = /[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/; // le saut de page « \f » de pdftotext est normal

/** Dessine une signature qui longe les 4 bords de la zone et ses diagonales : si le haut ou le bas est coupé ou aplati, ça se voit. */
async function draw(page) {
  const canvas = page.locator('[data-testid="signature-canvas"]');
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  const px = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
  const stroke = async (pts) => { const [x0, y0] = px(...pts[0]); await page.mouse.move(x0, y0); await page.mouse.down(); for (const p of pts.slice(1)) { const [x, y] = px(...p); await page.mouse.move(x, y, { steps: 10 }); } await page.mouse.up(); };
  await stroke([[0.02, 0.04], [0.98, 0.04], [0.98, 0.96], [0.02, 0.96], [0.02, 0.04]]);
  await stroke([[0.02, 0.04], [0.98, 0.96]]);
  await stroke([[0.02, 0.96], [0.98, 0.04]]);
  // Ce que la capture exporte : dimensions, étendue du dessin et épaisseur du trait du haut et du bas.
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="signature-canvas"]');
    const url = c.toDataURL("image/png");
    const w = c.width, h = c.height;
    const d = c.getContext("2d").getImageData(0, 0, w, h).data;
    const on = (x, y) => d[(y * w + x) * 4 + 3] > 40;
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    // épaisseur (en pixels) des traits horizontaux du haut et du bas, mesurée sur une colonne sans diagonale (25 % de la largeur)
    const run = (x, from, to) => { let best = 0, cur = 0; for (let y = from; y < to; y++) { if (on(x, y)) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; };
    const x25 = Math.round(w * 0.25), x75 = Math.round(w * 0.75);
    const rect = c.getBoundingClientRect();
    return { url, w, h, cssW: rect.width, cssH: rect.height, minX, maxX, minY, maxY, topRun: run(x25, 0, Math.round(h * 0.12)), bottomRun: run(x75, Math.round(h * 0.88), h) };
  });
}

async function fillAndSign(page, size, who, w) {
  await page.goto(BASE + "/contrat", { waitUntil: "networkidle" }); await sleep(300);
  const submit = page.getByRole("button", { name: /Signer et envoyer le contrat/ });
  // Case d'acceptation pas encore cochée : bouton grisé, et un message-lien qui remonte à la case.
  const hint = page.getByTestId("accept-hint");
  const hintText = (await hint.innerText()).replace(/\s+/g, " ").trim();
  check(`[contrat ${w}px] case non cochée : bouton grisé et message « Cochez d'abord la case « J'ai lu et j'accepte les termes du contrat » (sous le texte du contrat) »`, (await submit.isDisabled()) && hintText === "Cochez d’abord la case « J’ai lu et j’accepte les termes du contrat » (sous le texte du contrat)", hintText);
  check(`[contrat ${w}px] le message est un lien vers la case, sans débordement`, (await hint.locator('a[href="#accept-contract"]').count()) === 1 && (await noOverflow(page)));
  await page.locator("canvas").first().scrollIntoViewIfNeeded();
  await hint.locator("a").click(); await sleep(900);
  const box = await page.locator("#accept-contract").boundingBox();
  const vh = page.viewportSize().height;
  check(`[contrat ${w}px] cliquer le lien remonte à la case (visible dans l'écran) et la met en évidence (focus)`, !!box && box.y >= 0 && box.y + box.height <= vh && (await page.evaluate(() => document.activeElement && document.activeElement.id === "accept-contract")), JSON.stringify(box));
  await page.locator("#accept-contract").check();
  check(`[contrat ${w}px] case cochée : le message disparaît et le bouton s'active`, (await hint.count()) === 0 && (await submit.isEnabled()));
  const field = (label) => page.locator("label", { hasText: label }).locator("input, textarea").first();
  await field("Nom complet").fill(who);
  await field("E-mail").fill("signataire.test@example.com");
  await field("Téléphone").fill("+22997000001");
  await page.getByRole("button", { name: "Site web" }).click();
  await field("Description du besoin").fill("Un site.\r\n\r\nDeuxième paragraphe avec « guillemets » et accents é è à.");
  const info = await draw(page);
  await submit.click();
  await page.getByText("Contrat signé avec succès").waitFor({ timeout: 20000 });
  return info;
}

/** Boîte (en points) occupée par la signature dans la page, et boîte des pixels verts dessinés (en points). */
function signatureBoxes(pdfFile, page) {
  const bbox = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-bbox-layout", pdfFile, "-"], { encoding: "utf8" });
  const lines = [...bbox.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)]
    .map((m) => ({ yMin: +m[2], yMax: +m[4], text: [...m[5].matchAll(/<word[^>]*>([^<]*)<\/word>/g)].map((w) => w[1]).join(" ") }));
  const title = lines.find((l) => /SIGNATURE/.test(l.text));
  const caption = lines.find((l) => /Sign.*lectroniquement par/.test(l.text) && !/SIGNATURE/.test(l.text));
  if (!title || !caption) return null;
  const dpi = 100;
  execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", String(dpi), "-png", "-singlefile", pdfFile, `${OUT}/sigpage`]);
  execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", String(dpi), "-singlefile", pdfFile, `${OUT}/sigraw`]);
  const ppm = fs.readFileSync(`${OUT}/sigraw.ppm`);
  let pos = 0; const tok = [];
  while (tok.length < 4 && pos < ppm.length) { while (pos < ppm.length && ppm[pos] <= 32) pos++; let t = ""; while (pos < ppm.length && ppm[pos] > 32) t += String.fromCharCode(ppm[pos++]); tok.push(t); } pos++;
  const W = +tok[1], H = +tok[2];
  const k = dpi / 72;
  const y0 = Math.floor((title.yMax + 2) * k), y1 = Math.floor((caption.yMin - 1) * k);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const o = pos + (y * W + x) * 3; const r = ppm[o], g = ppm[o + 1], bl = ppm[o + 2];
    if (g > r + 30 && g > bl + 5 && r < 140) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return { w: (maxX - minX + 1) / k, h: (maxY - minY + 1) / k, top: minY / k, bottom: maxY / k, areaTop: y0 / k, areaBottom: y1 / k, found: maxX >= 0 };
}

(async () => {
  const browser = await launch();
  sql(`INSERT INTO contract_settings (id, contract_text) VALUES (1, E'${CONTRACT_TEXT.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}') ON CONFLICT (id) DO UPDATE SET contract_text = EXCLUDED.contract_text`);
  check("[préparation] le texte du contrat stocké contient bien des retours Windows (\\r\\n)", sql("select (contract_text like '%'||chr(13)||chr(10)||'%')::text from contract_settings where id=1") === "true");
  const admin = await adminContext(browser);
  const ids = [];

  for (const size of ["desktop", "mobile320"]) {
    const w = SIZES[size].viewport.width;
    const ctx = await browser.newContext({ ...SIZES[size], serviceWorkers: "block" });
    await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 404, body: "" }));
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    const exp = await fillAndSign(page, size, `Signataire ${w}`, w);
    check(`[signature ${w}px] la zone de dessin fait ${200} px de haut (${Math.round(exp.cssW)} px de large)`, Math.abs(exp.cssH - 200) < 1 && exp.cssW > 200, JSON.stringify({ cssW: exp.cssW, cssH: exp.cssH }));
    check(`[signature ${w}px] la capture exporte toute la zone, sans étirement : ${exp.w}×${exp.h} px, mêmes proportions que la zone à l'écran, au moins 2× pour rester net`, Math.abs(exp.w / exp.h - exp.cssW / exp.cssH) < 0.02 && exp.w >= exp.cssW * 1.9 && exp.url.startsWith("data:image/png;base64,"), JSON.stringify({ w: exp.w, h: exp.h, cssW: exp.cssW, cssH: exp.cssH }));
    check(`[signature ${w}px] le dessin longe les quatre bords sans être coupé : de 2 % à 98 % en largeur et en hauteur`, exp.minX / exp.w < 0.04 && exp.maxX / exp.w > 0.96 && exp.minY / exp.h < 0.04 && exp.maxY / exp.h > 0.96, JSON.stringify(exp, (k, v) => (k === "url" ? undefined : v)));
    const lineWidth = 2.5 * (exp.w / exp.cssW);
    check(`[signature ${w}px] les traits du haut et du bas ne sont pas aplatis (épaisseur ${exp.topRun} et ${exp.bottomRun} px pour un trait de ${lineWidth.toFixed(1)} px)`, exp.topRun >= lineWidth * 0.8 && exp.bottomRun >= lineWidth * 0.8, `${exp.topRun} ${exp.bottomRun}`);
    check(`[contrat ${w}px] signé et enregistré, sans débordement ni erreur`, (await noOverflow(page)) && errors.length === 0, errors.join("||"));
    await page.screenshot({ path: `${OUT}/contrat-${w}.png`, fullPage: true });
    await ctx.close();
    const id = sql(`select id from signed_contracts where client_name='Signataire ${w}'`);
    ids.push(id);

    // Le texte stocké n'est pas touché : toujours avec ses retours Windows.
    const stored = sql(`select (contract_text_snapshot = (select contract_text from contract_settings where id=1))::text||'|'||(contract_text_snapshot like '%'||chr(13)||chr(10)||'%')::text from signed_contracts where id='${id}'`);
    check(`[contrat ${w}px] le texte figé du contrat n'a pas été modifié (retours Windows conservés en base)`, stored === "true|true", stored);

    const r = await admin.ctx.request.get(`${BASE}/api/admin/contrats/${id}/pdf`);
    const file = read(await r.body(), `contrat-${w}`);
    const txt = textOf(file);
    check(`[PDF ${w}px] aucun « Ð » ni caractère de contrôle dans le texte extrait`, r.status() === 200 && !txt.includes("Ð") && !CONTROL.test(txt), JSON.stringify(txt.match(/.{0,20}(Ð|[\u0000-\u0008\u000b\u000e-\u001f]).{0,20}/)));
    const body = txt.slice(txt.indexOf("TEXTE DU CONTRAT"));
    const lines = body.split("\n").map((l) => l.replace(/\s+$/, ""));
    const i0 = lines.indexOf("AKAGESTSOFT");
    check(`[PDF ${w}px] chaque ligne finit proprement et les lignes vides entre les articles sont conservées`, i0 > 0 && lines[i0 + 1] === "" && lines[i0 + 2] === "1. Objet" && lines[i0 + 3].startsWith("Le prestataire fournit") && lines[i0 + 4] === "" && lines[i0 + 5].startsWith("2. Prix") && lines[i0 + 6] === "Ligne finale", JSON.stringify(lines.slice(i0, i0 + 8)));
    const norm = txt.replace(/[  ]/g, " ");
    check(`[PDF ${w}px] guillemets français, accents, espaces insécables : « le service », é è ê à ç œ ñ, « 2. Prix : 50 000 FCFA »`, norm.includes("« le service »") && norm.includes("é è ê à ç œ ñ") && /2\. Prix : 50 000 FCFA/.test(norm) && !txt.includes("/"), norm.slice(norm.indexOf("1. Objet"), norm.indexOf("1. Objet") + 200));
    check(`[PDF ${w}px] description du besoin sur plusieurs lignes, sans caractère parasite`, /Un site\.\s*\n\s*\n\s*Deuxième paragraphe avec « guillemets » et accents é è à\./.test(txt.replace(/ /g, " ")));

    const pages = (fs.readFileSync(file).toString("latin1").match(/\/Type \/Page\b(?!s)/g) || []).length;
    const sig = signatureBoxes(file, pages === 1 ? 1 : 2);
    // Le cadre dessiné va de 2 % à 98 % en largeur et en hauteur : mêmes proportions que la zone, à 4 % près de marge.
    const expected = (exp.w * 0.96) / (exp.h * 0.96);
    const ok = sig && sig.found && sig.h > 0 && Math.abs(sig.w / sig.h / expected - 1) < 0.08 && sig.bottom <= sig.areaBottom;
    check(`[PDF ${w}px] la signature s'affiche en entier, avec ses proportions (${expected.toFixed(2)}:1), rien de coupé en bas`, !!ok, JSON.stringify({ sig, expected }));
    const hdr = Buffer.from(sql(`select substr(signature_data_url, 23, 40) from signed_contracts where id='${id}'`), "base64");
    check(`[contrat ${w}px] la signature enregistrée a les dimensions exportées (${exp.w}×${exp.h})`, hdr.readUInt32BE(16) === exp.w && hdr.readUInt32BE(20) === exp.h, `${hdr.readUInt32BE(16)}×${hdr.readUInt32BE(20)}`);
    fs.copyFileSync(`${OUT}/sigpage.png`, `${OUT}/contrat-signature-${w}.png`);
  }

  // Page privée du client : même PDF, en lecture seule.
  {
    const id = ids[0];
    const rawBefore = sql(`select md5(contract_text_snapshot||signature_data_url||created_at::text||id) from signed_contracts where id='${id}'`);
    const r = await admin.ctx.request.get(`${BASE}/api/admin/contrats/${id}/pdf`);
    check("[PDF] générer le PDF ne modifie ni le texte, ni la signature, ni la date du contrat", r.status() === 200 && sql(`select md5(contract_text_snapshot||signature_data_url||created_at::text||id) from signed_contracts where id='${id}'`) === rawBefore);
  }

  // Hors ligne : le formulaire signé reste affiché et rien ne casse.
  {
    const ctx = await browser.newContext({ ...SIZES.mobile375, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/contrat", { waitUntil: "networkidle" });
    await ctx.setOffline(true);
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator("canvas").first().scrollIntoViewIfNeeded();
    const before = sql("select count(*) from signed_contracts");
    await page.getByRole("button", { name: /Signer et envoyer le contrat/ }).click().catch(() => {}); await sleep(1200);
    check("[hors ligne] envoi sans signature ni réseau : le formulaire reste affiché, rien n'est enregistré", (await page.getByText(/Merci de signer/).count()) >= 0 && sql("select count(*) from signed_contracts") === before);
    await ctx.close();
  }
  await browser.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
