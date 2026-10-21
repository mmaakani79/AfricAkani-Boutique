// Preloaded into the app server (NODE_OPTIONS=--require ...): redirects the calls
// the app makes to Stripe, PayPal and Resend to the local mock (mock-services.cjs).
// Nothing here ships with the site; it only exists in the e2e runs.
const https = require("node:https");
const http = require("node:http");

const MOCK = new URL(process.env.E2E_MOCK_URL || "http://127.0.0.1:4810");
const HOSTS = new Set(["api.stripe.com", "api-m.sandbox.paypal.com", "api-m.paypal.com", "api.resend.com"]);

// fetch (PayPal, Resend)
const realFetch = globalThis.fetch;
globalThis.fetch = function stubbedFetch(input, init) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let url;
  try { url = new URL(raw); } catch { return realFetch(input, init); }
  if (!HOSTS.has(url.hostname)) return realFetch(input, init);
  const target = `${MOCK.origin}/${url.hostname}${url.pathname}${url.search}`;
  return realFetch(typeof input === "object" && !(input instanceof URL) ? new Request(target, input) : target, init);
};

// node:https (the Stripe SDK)
const realRequest = https.request;
https.request = function stubbedRequest(first, second, third) {
  let opts = first;
  let cb = second;
  if (typeof first === "string" || first instanceof URL) {
    const u = new URL(first);
    opts = { hostname: u.hostname, path: u.pathname + u.search, ...(typeof second === "object" ? second : {}) };
    cb = typeof second === "function" ? second : third;
  }
  const host = opts.hostname || opts.host;
  if (!HOSTS.has(host)) return realRequest.call(this, first, second, third);
  const req = http.request(
    { host: MOCK.hostname, port: MOCK.port, path: `/${host}${opts.path || "/"}`, method: opts.method, headers: { ...opts.headers, host: MOCK.host } },
    cb,
  );
  // The Stripe SDK waits for the TLS "secureConnect" event before sending the body; a plain
  // connection to the local mock only emits "connect", so announce the secure one as well.
  req.on("socket", (socket) => {
    if (socket.connecting) socket.once("connect", () => socket.emit("secureConnect"));
    else socket.emit("secureConnect");
  });
  return req;
};
