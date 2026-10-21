// Outil (pas un spec) : mesure locale : poids du JavaScript chargé par la page d'accueil + temps d'affichage (médiane de 12 chargements).
const { BASE, launch } = require("../lib/common.cjs");
const path = require("path");
const zlib = require("zlib"), fs = require("fs");
// usage : node e2e/tools/measure.cjs <étiquette> [stub]   (stub = script de statistiques de substitution)
const label = process.argv[2] || "mesure", useStub = process.argv[3] === "stub";
const FAKE = fs.readFileSync(path.join(__dirname, "../lib/fake-analytics-script.js"), "utf8");
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
(async () => {
  const browser = await launch();
  const out = { label };
  for (const page_ of ["/", "/catalogue"]) {
    const runs = { fcp: [], lcp: [], dcl: [], load: [], jsGz: [], reqs: [] };
    for (let i = 0; i < 12; i++) {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: "block", userAgent: undefined });
      if (useStub) await ctx.route("**/_vercel/insights/**", (r) => r.request().url().endsWith("script.js") ? r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE }) : r.fulfill({ status: 200, body: "ok" }));
      const p = await ctx.newPage();
      await p.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); });
      let n = 0, js = 0;
      p.on("response", async (r) => { n++; if (/\.js(\?|$)/.test(r.url())) { try { const b = await r.body(); js += zlib.gzipSync(b).length; } catch {} } });
      await p.goto(BASE + page_, { waitUntil: "networkidle" }); await new Promise((r) => setTimeout(r, 800));
      const m = await p.evaluate(() => { const nav = performance.getEntriesByType("navigation")[0]; const fcp = performance.getEntriesByName("first-contentful-paint")[0]; return { fcp: fcp ? fcp.startTime : 0, lcp: window.__lcp, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd }; });
      for (const k of ["fcp", "lcp", "dcl", "load"]) runs[k].push(m[k]);
      runs.jsGz.push(js); runs.reqs.push(n);
      await ctx.close();
    }
    out[page_] = Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, Math.round(med(v))]));
  }
  await browser.close();
  console.log(JSON.stringify(out));
})();
