// Slogan « Votre Satisfaction, Notre Réussite ! » : il termine TOUS les reçus et confirmations envoyés
// au client (courriels, pages, facture PDF, messages WhatsApp), et il vient d'un seul endroit.
// Appelle les VRAIS envois vers un faux Resend local. Lancer avec `npm test`.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { RECEIPT_SLOGAN, withReceiptSlogan, withReceiptSloganText } from "@/lib/receipt-slogan";
import { renderReceiptEmail } from "@/lib/email-html";
import { PROVIDER_LINE, buildServiceReceipt } from "@/lib/service-receipt";
import type { OrderDetail } from "@/lib/orders-db";
import type { SignedContract } from "@/lib/contracts-db";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const EXACT = "Votre Satisfaction, Notre Réussite !";

interface SentEmail {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

describe("le slogan : un seul endroit, texte exact", () => {
  it("l'orthographe et les majuscules sont exactes", () => {
    assert.equal(RECEIPT_SLOGAN, EXACT);
  });

  it("withReceiptSlogan : dernier élément, une seule fois, lignes vides finales ignorées", () => {
    const once = withReceiptSlogan(["Bonjour", "", "L'équipe", ""]);
    assert.deepEqual(once, ["Bonjour", "", "L'équipe", "", EXACT]);
    assert.deepEqual(withReceiptSlogan(once), once);
  });

  it("withReceiptSloganText : ajouté à la fin d'un message WhatsApp, une seule fois", () => {
    const t = withReceiptSloganText("Merci !");
    assert.equal(t, `Merci ! ${EXACT}`);
    assert.equal(withReceiptSloganText(t), t);
  });

  it("le texte exact n'est écrit qu'à un seul endroit du code", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && read(rel).includes("Notre Réussite")) hits.push(rel);
      }
    };
    walk("src");
    assert.deepEqual(hits, ["src/lib/receipt-slogan.ts"]);
  });
});

describe("renderReceiptEmail : texte et HTML se terminent par le slogan", () => {
  const { text, html } = renderReceiptEmail("Sujet", ["Bonjour", "", "Corps"]);
  it("texte : dernière ligne", () => assert.ok(text.endsWith(`\n${EXACT}`)));
  it("HTML : après la mention du bas de page, et lisible (gras, 18 px, blanc sur vert)", () => {
    assert.ok(html.indexOf(EXACT) > html.indexOf("Boutique généraliste africaine"));
    assert.equal(html.split(EXACT).length - 1, 1);
    assert.match(html, /background:#0e5a44;color:#ffffff;font-size:18px[^"]*font-weight:bold/);
  });
});

describe("reçu de paiement de service", () => {
  const receipt = buildServiceReceipt({
    merchantName: "Volaille de Djougou",
    clientName: "Awa Koné",
    payment: { id: "PAY-1", amount: 5000, method: "mobile_money", mmOperator: "MTN", paidOn: "2026-10-13", confirmedAt: "2026-10-13T10:00:00Z", createdAt: "2026-10-13T09:00:00Z" },
    state: { adjustedTotal: 100000, paid: 5000, remaining: 95000, reductions: 0, next: null },
    deposit: true,
  });
  it("phrase du fournisseur : « Service fourni par AkaGest. » partout, sans « (A. ARINLOYE) »", () => {
    assert.equal(PROVIDER_LINE, "Service fourni par AkaGest.");
    assert.ok(receipt.closing.includes("Service fourni par AkaGest."));
    assert.ok(receipt.whatsappText.includes("Service fourni par AkaGest."));
    assert.ok(!/ARINLOYE/.test([...receipt.lines, ...receipt.closing].join("\n") + receipt.whatsappText));
  });
  it("le message WhatsApp du reçu se termine par le slogan", () => assert.ok(receipt.whatsappText.endsWith(EXACT)));
  it("la phrase du fournisseur n'a plus « (A. ARINLOYE) » nulle part dans le code du module", () => {
    for (const f of ["src/lib/service-receipt.ts", "src/app/paiement-service/[token]/page.tsx"]) {
      assert.ok(!/AkaGest \(A\. ARINLOYE\)/.test(read(f)), f);
      assert.ok(!/fourni[t]? par AkaGest \(/i.test(read(f)), f);
    }
  });
});

describe("courriels envoyés pour de vrai vers un faux Resend", () => {
  const sent: { label: string; mail: SentEmail }[] = [];
  let server: http.Server;
  let current = "";
  const saved: Record<string, string | undefined> = {};

  before(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        if (req.method === "POST") sent.push({ label: current, mail: JSON.parse(body) });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id: "mock" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const env: Record<string, string> = {
      RESEND_API_KEY: "re_localtestkey123456",
      RESEND_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      RESEND_FROM: "AfricAkani <no-reply@test.africakani.local>",
      NEXT_PUBLIC_SITE_URL: "https://www.africakani.com",
      ADMIN_NOTIFY_EMAIL: "admin-test@example.com",
    };
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    const email = await import("@/lib/email");
    const order = {
      id: "AK-TEST1", createdAt: "2026-10-13T13:32:00.000Z", zoneId: "bj", subtotal: 25000, shippingFee: 0,
      customerName: "Awa Koné", customerPhone: "+229 97 00 00 00", status: "pending", paymentStatus: "pending", isTest: false,
      customerEmail: "awa@example.com", customerAddress: "Rue 12", customerCity: "Cotonou", customerApartment: null,
      customerProvince: null, customerPostalCode: null, customerCountry: "Bénin", freeShippingReached: true,
      paymentMethod: "mobile_money", reminder24hSentAt: null, reminder48hSentAt: null, emailError: null,
      mobileMoneyOperator: "MTN", mobileMoneyPhone: "+229 97 00 00 00", mobileMoneyTransactionId: "TX123",
      stripeCheckoutSessionId: null, stripePaymentIntentId: null, paypalOrderId: null, paypalCaptureId: null,
      items: [{ productId: "p02", productName: "Beurre de karité", productSku: "AK-P02", quantity: 2, unitPrice: 12500, lineTotal: 25000 }],
      reminders: [],
    } as unknown as OrderDetail;
    const contract: SignedContract = {
      id: "CT-MGX4F2K9-7QHD", createdAt: "2026-10-13T13:32:00.000Z", clientName: "Awa Koné", clientEmail: "awa@example.com",
      clientPhone: "+229 97 00 00 00", companyName: "Koné & Fils", services: ["Site web"], projectDescription: "Un site.",
      budget: "", timeline: "", notes: "", contractTextSnapshot: "Texte", signatureDataUrl: "data:image/png;base64,AAAA",
      emails: { admin: { sentAt: null, error: null, claimedAt: null }, client: { sentAt: null, error: null, claimedAt: null } },
    };
    const run = async (label: string, fn: () => Promise<unknown>) => {
      current = label;
      await fn();
    };
    const receipt = buildServiceReceipt({
      merchantName: "Volaille de Djougou", clientName: "Awa Koné",
      payment: { id: "PAY-1", amount: 5000, method: "mobile_money", mmOperator: "MTN", paidOn: "2026-10-13", confirmedAt: "2026-10-13T10:00:00Z", createdAt: "2026-10-13T09:00:00Z" },
      state: { adjustedTotal: 100000, paid: 5000, remaining: 95000, reductions: 0, next: null },
      deposit: true,
    });
    await run("recu-service", () => email.sendServicePaymentReceipt({ to: "awa@example.com", replyTo: "contact@akagest.com", subject: receipt.subject, lines: receipt.lines, closing: receipt.closing }));
    await run("recu-service-test", () =>
      email.sendServicePaymentReceipt({ to: "admin-test@example.com", replyTo: "contact@akagest.com", subject: `[TEST] ${receipt.subject}`, lines: ["[TEST — prévisualisation] Ce reçu n'a PAS été envoyé au client.", "", ...receipt.lines], closing: receipt.closing })
    );
    await run("commande-client", () => email.sendCustomerOrderConfirmation(order));
    await run("paiement-confirme", () => email.sendCustomerPaymentConfirmed(order));
    await run("contrat-client", () => email.sendContractClientEmail(contract, Buffer.from("%PDF-1.4 faux pdf")));
    await run("commande-admin", () => email.sendAdminNewOrderNotification(order));
    await run("commande-expediee", () => email.sendCustomerOrderShipped(order));
    await run("rappel", () => email.sendCustomerPaymentReminder(order, 1));
    await run("invitation-avis", () => email.sendCustomerReviewInvite(order));
    await run("commande-annulee", () => email.sendCustomerOrderCancelled(order));
    await run("contrat-admin", () => email.sendContractAdminEmail(contract));
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise((r) => server.close(r));
  });

  const RECEIPTS = ["recu-service", "recu-service-test", "commande-client", "paiement-confirme", "contrat-client"];
  const NOT_RECEIPTS = ["commande-admin", "commande-expediee", "rappel", "invitation-avis", "commande-annulee", "contrat-admin"];

  it("les reçus et confirmations au client se terminent par le slogan (texte ET HTML, en dernier)", () => {
    for (const label of RECEIPTS) {
      const mail = sent.find((s) => s.label === label)?.mail;
      assert.ok(mail, `${label} : envoyé`);
      assert.ok(mail.text.trimEnd().endsWith(EXACT), `${label} : texte`);
      assert.equal(mail.text.split(EXACT).length - 1, 1, `${label} : une seule fois (texte)`);
      assert.equal(mail.html.split(EXACT).length - 1, 1, `${label} : une seule fois (HTML)`);
      assert.ok(mail.html.indexOf(EXACT) > mail.html.indexOf("Boutique généraliste africaine"), `${label} : après les mentions`);
    }
  });

  it("l'aperçu [TEST] du reçu de service a le slogan, et le reçu ne cite plus « (A. ARINLOYE) »", () => {
    const preview = sent.find((s) => s.label === "recu-service-test")!.mail;
    assert.match(preview.text, /\[TEST/);
    assert.ok(preview.text.includes("Service fourni par AkaGest."));
    for (const label of ["recu-service", "recu-service-test"]) assert.ok(!/ARINLOYE/.test(sent.find((s) => s.label === label)!.mail.html));
  });

  it("les autres messages (alertes admin, expédition, rappel, avis, annulation) restent inchangés : pas de slogan", () => {
    for (const label of NOT_RECEIPTS) {
      const mail = sent.find((s) => s.label === label)!.mail;
      assert.ok(!mail.text.includes(EXACT) && !mail.html.includes(EXACT), label);
    }
  });

  it("la signature « L'équipe AfricAkani » reste centrée (commande, paiement confirmé, contrat signé), le détail à gauche", () => {
    for (const label of ["commande-client", "paiement-confirme", "contrat-client"]) {
      const html = sent.find((s) => s.label === label)!.mail.html;
      const start = html.indexOf('data-receipt-closing="1"');
      assert.ok(start > 0, `${label} : bloc de conclusion`);
      const closing = html.slice(start, html.indexOf("</td>", start));
      assert.match(closing, /align="center"/, label);
      assert.match(closing, /text-align:center/, label);
      assert.ok(closing.includes("L&#39;équipe AfricAkani"), `${label} : signature dans le bloc centré`);
      assert.ok(html.indexOf("Bonjour") < start, `${label} : le corps du message est avant, à gauche`);
      assert.ok(!/text-align:center/.test(html.slice(html.indexOf("Bonjour") - 80, html.indexOf("Bonjour") + 40)), label);
    }
  });

  it("la confirmation de contrat garde sa signature avant le slogan", () => {
    const mail = sent.find((s) => s.label === "contrat-client")!.mail;
    assert.ok(mail.text.trimEnd().endsWith(`L'équipe AfricAkani\n\n${EXACT}`));
  });
});

describe("tout futur reçu l'aura : les fonctions d'envoi de reçu passent par renderReceiptEmail", () => {
  const code = read("src/lib/email.ts");
  const names = [...code.matchAll(/export async function (send\w+)/g)].map((m) => m[1]);
  const body = (name: string) => {
    const start = code.indexOf(`export async function ${name}`);
    const next = code.indexOf("export async function", start + 10);
    return code.slice(start, next === -1 ? undefined : next);
  };
  it("tout envoi dont le nom contient Receipt / Confirm utilise renderReceiptEmail (jamais renderEmailHtml seul)", () => {
    const receipts = names.filter((n) => /Receipt|Confirm|Contract.*Client/.test(n));
    assert.ok(receipts.length >= 4, receipts.join(", "));
    for (const n of receipts) {
      assert.ok(body(n).includes("renderReceiptEmail("), n);
      assert.ok(!body(n).includes("renderEmailHtml("), n);
    }
  });
});

describe("pages de confirmation : le slogan est tout en bas", () => {
  const pages: [string, string][] = [
    ["src/app/commande/page.tsx", "page de confirmation de commande (hors Stripe/PayPal)"],
    ["src/app/commande/succes/page.tsx", "page de succès après paiement par carte / PayPal"],
    ["src/app/contrat/contract-form.tsx", "écran de confirmation du contrat signé"],
    ["src/app/paiement-service/[token]/page.tsx", "page privée du client (reçus et paiements du service)"],
  ];
  for (const [file, label] of pages) {
    it(label, () => {
      const code = read(file);
      assert.ok(code.includes("<ReceiptSlogan"), file);
      assert.ok(!code.includes("Notre Réussite"), "le texte vient du composant commun");
    });
  }
  it("le composant est lisible : gras, 16 px, retour à la ligne autorisé (320 px)", () => {
    const c = read("src/components/receipt-slogan.tsx");
    assert.match(c, /text-base font-bold/);
    assert.match(c, /break-words/);
    assert.match(c, /w-full/);
  });
});

describe("messages WhatsApp de confirmation", () => {
  it("« paiement reçu » de la commande se termine par le slogan", async () => {
    const { whatsappPaymentConfirmedHref } = await import("@/lib/whatsapp");
    const href = whatsappPaymentConfirmedHref({ id: "AK-1", customerName: "Awa Koné", customerPhone: "+229 97 00 00 00", subtotal: 25000, shippingFee: 0, zoneId: "bj" } as never);
    const text = decodeURIComponent(href.split("?text=")[1]);
    assert.ok(text.endsWith(EXACT), text);
  });
  it("le rappel de paiement n'est pas un reçu : inchangé", async () => {
    const { whatsappReminderHref } = await import("@/lib/whatsapp");
    const href = whatsappReminderHref({ id: "AK-1", customerName: "Awa", customerPhone: "+229 97 00 00 00", subtotal: 25000, shippingFee: 0, zoneId: "bj" } as never);
    assert.ok(!decodeURIComponent(href).includes(EXACT));
  });
});

describe("facture PDF", () => {
  it("une seule page, le slogan est présent sous les mentions du bas de page", async () => {
    const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
    const order = {
      id: "AK-TEST1", createdAt: "2026-10-13T13:32:00.000Z", zoneId: "bj", subtotal: 25000, shippingFee: 0,
      customerName: "Awa Koné", customerPhone: "+229 97 00 00 00", status: "pending", paymentStatus: "pending",
      customerEmail: "awa@example.com", customerAddress: "Rue 12", customerCity: "Cotonou", customerApartment: null,
      customerProvince: null, customerPostalCode: null, customerCountry: "Bénin", paymentMethod: "mobile_money",
      mobileMoneyOperator: "MTN", mobileMoneyTransactionId: "TX123", paypalCaptureId: null,
      items: [{ productName: "Beurre de karité", quantity: 2, unitPrice: 12500, lineTotal: 25000 }],
    } as unknown as OrderDetail;
    const pdf = await generateInvoicePdf(order);
    const pages = (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
    assert.equal(pages, 1, "le slogan ne doit pas ouvrir une deuxième page");
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "facture-")), "f.pdf");
    fs.writeFileSync(file, pdf);
    let text = "";
    try {
      text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
    } catch {
      return; // pdftotext absent : le test de pages ci-dessus reste valable
    }
    assert.ok(text.includes(EXACT), text.slice(-300));
    assert.ok(text.indexOf(EXACT) > text.indexOf("contact@africakani.com"), "après les mentions du bas");
  });
});
