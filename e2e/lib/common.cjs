// Shared helpers for the end-to-end specs (see e2e/README.md).
// Everything runs against a throw-away LOCAL database and a local copy of the
// built app — never production, never a real payment provider.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"]) {
    if (!name) continue;
    try { return require(name); } catch { /* try the next location */ }
  }
  throw new Error("Playwright introuvable : installez-le (npm i -g playwright) ou fixez PLAYWRIGHT_MODULE.");
}
const { chromium, devices } = loadPlaywright();

const PORT = process.env.E2E_PORT || "4603";
const BASE = process.env.E2E_BASE || `http://localhost:${PORT}`;
const OUT = process.env.E2E_OUT || path.join(process.env.TMPDIR || "/tmp", "africakani-e2e");
const DB_URL = process.env.E2E_DB_URL || "postgres://akani:local@localhost:5432/akani_e2e";
const ADMIN_PW = process.env.ADMIN_PASSWORD || "local-admin-pass";
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : "  → " + detail}`);
};
const info = (m) => console.log("INFO  " + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function finish() {
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

/** Run one SQL statement on the local test database; returns the text result. */
const sql = (q) => execFileSync("psql", [DB_URL, "-At", "-F", "|", "-c", q]).toString().trim();

/** Lines of a JSONL log written by the local mock services (Stripe/PayPal calls, e-mails). */
function logLines(name) {
  try {
    return fs.readFileSync(path.join(OUT, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}
const providerCalls = () => logLines("payments.jsonl").length;

const SIZES = {
  desktop: { viewport: { width: 1280, height: 900 } },
  tablet768: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } },
  mobile375: { ...devices["iPhone 13"], viewport: { width: 375, height: 667 } },
  mobile320: { ...devices["iPhone 13"], viewport: { width: 320, height: 640 } },
};

function launch() {
  const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

module.exports = { BASE, OUT, DB_URL, ADMIN_PW, SIZES, check, info, sleep, finish, sql, logLines, providerCalls, launch, noOverflow, devices };
