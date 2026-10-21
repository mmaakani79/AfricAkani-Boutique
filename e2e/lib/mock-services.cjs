// Tiny local stand-in for Stripe, PayPal and Resend (e-mails). The app's calls to
// those hosts are redirected here by stub-providers.cjs. Every call is logged so
// the specs can prove that a refused order never reached a payment provider.
//   payments.jsonl : Stripe + PayPal calls     emails.jsonl : e-mails "sent"
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = process.env.E2E_OUT || path.join(process.env.TMPDIR || "/tmp", "africakani-e2e");
fs.mkdirSync(OUT, { recursive: true });
const PAY_LOG = path.join(OUT, "payments.jsonl");
const MAIL_LOG = path.join(OUT, "emails.jsonl");
fs.writeFileSync(PAY_LOG, "");
fs.writeFileSync(MAIL_LOG, "");
let n = 0;

const json = (res, body, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      // Requests arrive as /<original host>/<original path>
      const [, host, ...rest] = req.url.split("?")[0].split("/");
      const p = "/" + rest.join("/");
      n++;
      if (host === "api.stripe.com") {
        fs.appendFileSync(PAY_LOG, JSON.stringify({ provider: "stripe", method: req.method, path: p, body: raw }) + "\n");
        if (req.method === "POST" && p === "/v1/checkout/sessions") {
          return json(res, { id: `cs_test_e2e_${n}`, object: "checkout.session", url: `https://checkout.stripe.com/c/pay/cs_test_e2e_${n}` });
        }
        return json(res, { id: "cs_test_e2e", object: "checkout.session", payment_status: "unpaid", metadata: {} });
      }
      if (host.includes("paypal.com")) {
        fs.appendFileSync(PAY_LOG, JSON.stringify({ provider: "paypal", method: req.method, path: p, body: raw }) + "\n");
        if (p === "/v1/oauth2/token") return json(res, { access_token: "e2e-token", token_type: "Bearer", expires_in: 32400 });
        if (req.method === "POST" && p === "/v2/checkout/orders") {
          return json(res, { id: `E2EPAYPAL${n}`, status: "CREATED", links: [{ rel: "approve", href: `https://www.sandbox.paypal.com/checkoutnow?token=E2EPAYPAL${n}` }] });
        }
        return json(res, {});
      }
      if (host === "api.resend.com") {
        let body = {};
        try { body = JSON.parse(raw); } catch { /* not JSON */ }
        fs.appendFileSync(MAIL_LOG, JSON.stringify({ to: body.to, subject: body.subject }) + "\n");
        return json(res, { id: `e2e-email-${n}` });
      }
      json(res, { error: "unknown host " + host }, 404);
    });
  })
  .listen(Number(process.env.E2E_MOCK_PORT || 4810), "127.0.0.1", () => console.log("mock services ready"));
