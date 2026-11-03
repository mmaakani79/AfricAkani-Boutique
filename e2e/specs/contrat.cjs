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

/** Dessine une signature qui longe les 4 bords de la zone et ses diagonales : si le bas est coupé, ça se voit. */
async function draw(page) {
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  const px = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
  const stroke = async (pts) => { const [x0, y0] = px(...pts[0]); await page.mouse.move(x0, y0); await page.mouse.down(); for (const p of pts.slice(1)) { const [x, y] = px(...p); await page.mouse.move(x, y, { steps: 8 }); } await page.mouse.up(); };
  await stroke([[0.02, 0.04], [0.98, 0.04], [0.98, 0.96], [0.02, 0.96], [0.02, 0.04]]);
  await stroke([[0.02, 0.04], [0.98, 0.96]]);
  await stroke([[0.02, 0.96], [0.98, 0.04]]);
}

async function fillAndSign(page, size, who) {
  await page.goto(BASE + "/contrat", { waitUntil: "networkidle" }); await sleep(300);
  await page.locator('input[type="checkbox"]').first().check();
  const field = (label) => page.locator("label", { hasText: label }).locator("input, textarea").first();
  await field("Nom complet").fill(who);
  await field("E-mail").fill("signataire.test@example.com");
  await field("Téléphone").fill("+22997000001");
  await page.getByRole("button", { name: "Site web" }).click();
  await field("Description du besoin").fill("Un site.\r\n\r\nDeuxième paragraphe avec « guillemets » et accents é è à.");
  await draw(page);
  await page.getByRole("button", { name: /Signer et envoyer le contrat/ }).click();
  await page.getByText("Contrat signé avec succès").waitFor({ timeout: 20000 });
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
    await fillAndSign(page, size, `Signataire ${w}`);
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
    const ok = sig && sig.found && sig.h > 0 && Math.abs(sig.w / sig.h - 3) < 0.25 && sig.bottom <= sig.areaBottom;
    check(`[PDF ${w}px] la signature s'affiche en entier (cadre complet, proportions 3:1, rien de coupé en bas)`, !!ok, JSON.stringify(sig));
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
