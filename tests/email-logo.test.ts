// Logo des e-mails : jamais d'adresse vercel.app, logo intégré au message, lisible, nom non coupé.
// Appelle les VRAIS envois (les 12 e-mails du site) vers un faux serveur Resend local.
// Lancer avec `npm test`.

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { renderEmailHtml } from "@/lib/email-html";
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_DISPLAY_HEIGHT,
  EMAIL_LOGO_DISPLAY_WIDTH,
  emailLogoPng,
  withInlineLogo,
} from "@/lib/email-logo";
import type { OrderDetail } from "@/lib/orders-db";
import type { SignedContract } from "@/lib/contracts-db";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PREVIEW_URL = "https://africakani-boutique-git-test-paiements-akani.vercel.app";
const DEPLOYMENT_HOST = "africakani-boutique-abc123xyz-akani.vercel.app";

interface SentAttachment {
  filename: string;
  content: string;
  content_id?: string;
  content_type?: string;
}
interface SentEmail {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: SentAttachment[];
}

const imgSources = (html: string) => [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)].map((m) => m[1]);

describe("modèle d'e-mail : le logo", () => {
  const html = renderEmailHtml("Sujet", ["Bonjour", "", "Corps du message"]);

  it("le logo est référencé par Content-ID (cid:), jamais par une adresse web", () => {
    assert.deepEqual(imgSources(html), [`cid:${EMAIL_LOGO_CID}`]);
    assert.ok(!/https?:\/\/[^"' ]*\.(png|webp|jpg|jpeg|gif|svg)/i.test(html), "aucune adresse d'image distante");
  });

  it("nom lisible : texte alternatif « AfricAkani », largeur fixe, jamais plus large que l'écran", () => {
    assert.match(html, /alt="AfricAkani"/);
    assert.match(html, new RegExp(`width="${EMAIL_LOGO_DISPLAY_WIDTH}"\\s+height="${EMAIL_LOGO_DISPLAY_HEIGHT}"`));
    assert.match(html, /max-width:100%;height:auto/);
    assert.match(html, /font-size:26px;font-weight:bold[^"]*color:#0e5a44/, "si l'image est bloquée, le texte alternatif reste lisible");
  });

  it("l'en-tête du logo est clair (le nom foncé n'est jamais posé sur le vert foncé)", () => {
    const header = html.slice(html.indexOf("cid:") - 400, html.indexOf("cid:"));
    assert.match(header, /background:#ffffff/);
    assert.ok(!/background:#0e5a44;padding:22px/.test(html));
  });

  it("l'image intégrée est un vrai PNG aux bonnes proportions", () => {
    const png = emailLogoPng();
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.ok(w >= EMAIL_LOGO_DISPLAY_WIDTH * 2 - 1, `assez grande pour les écrans haute densité (${w}px)`);
    assert.ok(Math.abs(h / w - EMAIL_LOGO_DISPLAY_HEIGHT / EMAIL_LOGO_DISPLAY_WIDTH) < 0.01, `proportions ${w}x${h}`);
    assert.ok(png.length < 60_000, `léger (${png.length} octets)`);
  });

  it("withInlineLogo ajoute le logo en pièce jointe intégrée, sans écraser les autres pièces jointes", () => {
    const withPdf = withInlineLogo({ html, attachments: [{ filename: "contrat.pdf", content: Buffer.from("x") }] });
    assert.equal(withPdf.attachments!.length, 2);
    assert.equal((withPdf.attachments![1] as unknown as { contentId: string }).contentId, EMAIL_LOGO_CID);
    const plain = { html: "<p>pas de logo</p>" };
    assert.equal(withInlineLogo(plain), plain, "un message sans logo n'est pas modifié");
  });
});

describe("code : aucune adresse de déploiement dans les e-mails", () => {
  const files = ["src/lib/email-html.ts", "src/lib/email-logo.ts", "src/lib/email.ts", "src/lib/contract-email-content.ts"];

  it("aucun fichier d'e-mail ne lit VERCEL_URL ni ne mentionne vercel.app", () => {
    for (const f of files) {
      const code = read(f);
      assert.ok(!/VERCEL_URL|VERCEL_BRANCH_URL|VERCEL_PROJECT_PRODUCTION_URL|vercel\.app/i.test(code), f);
    }
  });

  it("le modèle HTML n'utilise plus l'adresse du site pour le logo", () => {
    const code = read("src/lib/email-html.ts");
    assert.ok(!/getSiteUrl|NEXT_PUBLIC_SITE_URL/.test(code));
  });

  it("signature du client : « L'équipe AfricAkani »", () => {
    const content = read("src/lib/contract-email-content.ts");
    assert.match(content, /"L'équipe AfricAkani"/);
    assert.ok(!/AkaGestSoft"/.test(content.replace(/Contrat de prestation[^\n]*/g, "")), "plus de signature AkaGestSoft");
  });
});

describe("les 12 e-mails du site, envoyés pour de vrai vers un faux Resend, sur un déploiement Preview", () => {
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
      // Un déploiement Preview : l'adresse du site ET celle du déploiement sont des vercel.app
      NEXT_PUBLIC_SITE_URL: PREVIEW_URL,
      VERCEL_URL: DEPLOYMENT_HOST,
      VERCEL_ENV: "preview",
      ADMIN_NOTIFY_EMAIL: "admin-test@example.com",
    };
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }

    const email = await import("@/lib/email");
    const order = {
      id: "AK-TEST1",
      createdAt: "2026-10-13T13:32:00.000Z",
      zoneId: "bj",
      subtotal: 25000,
      shippingFee: 0,
      customerName: "Awa Koné",
      customerPhone: "+229 97 00 00 00",
      status: "pending",
      paymentStatus: "pending",
      isTest: false,
      customerEmail: "awa@example.com",
      customerAddress: "Rue 12",
      customerCity: "Cotonou",
      customerApartment: null,
      customerProvince: null,
      customerPostalCode: null,
      customerCountry: "Bénin",
      freeShippingReached: true,
      paymentMethod: "mobile_money",
      reminder24hSentAt: null,
      reminder48hSentAt: null,
      emailError: null,
      mobileMoneyOperator: "MTN",
      mobileMoneyPhone: "+229 97 00 00 00",
      mobileMoneyTransactionId: "TX123",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      paypalOrderId: null,
      paypalCaptureId: null,
      items: [{ productId: "p02", productName: "Beurre de karité", productSku: "AK-P02", quantity: 2, unitPrice: 12500, lineTotal: 25000 }],
      reminders: [],
    } as unknown as OrderDetail;
    const contract: SignedContract = {
      id: "CT-MGX4F2K9-7QHD",
      createdAt: "2026-10-13T13:32:00.000Z",
      clientName: "Awa Koné",
      clientEmail: "awa@example.com",
      clientPhone: "+229 97 00 00 00",
      companyName: "Koné & Fils",
      services: ["Site web"],
      projectDescription: "Un site.",
      budget: "",
      timeline: "",
      notes: "",
      contractTextSnapshot: "Texte",
      signatureDataUrl: "data:image/png;base64,AAAA",
      emails: { admin: { sentAt: null, error: null, claimedAt: null }, client: { sentAt: null, error: null, claimedAt: null } },
    };
    const run = async (label: string, fn: () => Promise<unknown>) => {
      current = label;
      await fn();
    };

    await run("test", () => email.sendTestEmail());
    await run("demande-produit", () =>
      email.sendProductRequestNotification({ id: 1, createdAt: "2026-10-13T13:32:00.000Z", emailSent: false, handled: false, productName: "Café", description: "du café", phone: "+229 1", email: "x@example.com" })
    );
    await run("commande-admin", () => email.sendAdminNewOrderNotification(order));
    await run("commande-client", () => email.sendCustomerOrderConfirmation(order));
    await run("commande-expediee", () => email.sendCustomerOrderShipped(order));
    await run("rappel-1", () => email.sendCustomerPaymentReminder(order, 1));
    await run("rappel-2", () => email.sendCustomerPaymentReminder(order, 2));
    await run("paiement-confirme", () => email.sendCustomerPaymentConfirmed(order));
    await run("invitation-avis", () => email.sendCustomerReviewInvite(order));
    await run("commande-annulee", () => email.sendCustomerOrderCancelled(order));
    await run("contrat-admin", () => email.sendContractAdminEmail(contract));
    await run("contrat-client", () => email.sendContractClientEmail(contract, Buffer.from("%PDF-1.4 faux pdf pour le test")));
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise((r) => server.close(r));
  });

  it("les conditions du test sont bien celles d'un Preview (adresse du site = vercel.app)", async () => {
    const { getSiteUrl } = await import("@/lib/order-config");
    process.env.NEXT_PUBLIC_SITE_URL = PREVIEW_URL;
    assert.ok(getSiteUrl().includes("vercel.app"));
  });

  it("les 12 messages sont partis", () => {
    assert.equal(sent.length, 12, sent.map((s) => s.label).join(", "));
  });

  it("aucune adresse d'image ne contient vercel.app (ni aucune autre adresse distante)", () => {
    for (const { label, mail } of sent) {
      const sources = imgSources(mail.html);
      assert.ok(sources.length >= 1, `${label} : un logo`);
      for (const src of sources) {
        assert.ok(!/vercel/i.test(src), `${label} : ${src}`);
        assert.ok(src.startsWith("cid:") || src.startsWith("https://www.africakani.com/"), `${label} : ${src}`);
      }
    }
  });

  it("chaque message embarque le logo en pièce jointe intégrée (Content-ID), PNG valide", () => {
    for (const { label, mail } of sent) {
      const logo = (mail.attachments ?? []).find((a) => a.content_id === EMAIL_LOGO_CID);
      assert.ok(logo, `${label} : logo intégré`);
      assert.equal(logo.filename, "africakani-logo.png", label);
      assert.equal(logo.content_type, "image/png", label);
      assert.deepEqual(Buffer.from(logo.content, "base64"), emailLogoPng(), label);
    }
  });

  it("le texte brut (sans HTML) ne contient ni logo ni adresse vercel.app dans les images", () => {
    for (const { label, mail } of sent) assert.ok(!/cid:/.test(mail.text), label);
  });

  it("e-mail du contrat au client : le PDF ET le logo sont joints, signature « L'équipe AfricAkani »", () => {
    const mail = sent.find((s) => s.label === "contrat-client")!.mail;
    const names = (mail.attachments ?? []).map((a) => a.filename).sort();
    assert.deepEqual(names, ["africakani-logo.png", "contrat-CT-MGX4F2K9-7QHD.pdf"]);
    assert.ok(mail.text.trim().endsWith("L'équipe AfricAkani"));
    assert.ok(!/AkaGestSoft/.test(mail.text));
  });

  it("e-mail du contrat à l'administrateur : le contrat n'est pas joint (seul le logo l'est)", () => {
    const mail = sent.find((s) => s.label === "contrat-admin")!.mail;
    assert.deepEqual((mail.attachments ?? []).map((a) => a.filename), ["africakani-logo.png"]);
  });

  it("expéditeur et adresses inchangés", () => {
    for (const { label, mail } of sent) assert.equal(mail.from, "AfricAkani <no-reply@test.africakani.local>", label);
    assert.equal([].concat(sent.find((s) => s.label === "contrat-admin")!.mail.to as never).join(), "admin-test@example.com");
    assert.equal([].concat(sent.find((s) => s.label === "commande-client")!.mail.to as never).join(), "awa@example.com");
  });
});
