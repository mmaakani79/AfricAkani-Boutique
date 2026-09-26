import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import type { SignedContract } from "./contracts-db";

const GREEN = "#0e5a44";
const GOLD = "#c9962c";
const INK = "#1c1c1a";
const MUTED = "#6b6b66";
const LINE = "#e5ded0";

function loadLogoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "logo", "medallion.png"));
  } catch {
    return null;
  }
}

/** "data:image/png;base64,...." -> raw PNG bytes, or null if malformed. */
function decodeSignature(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

function addField(
  doc: PDFKit.PDFDocument,
  marginX: number,
  y: number,
  width: number,
  label: string,
  value: string
): number {
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GOLD).text(label, marginX, y, { width });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(value || "—", marginX, doc.y + 1, { width });
  return doc.y + 10;
}

/** Renders a one-page-plus PDF of a signed contract — the frozen contract
 *  text, the client's cahier des charges answers, and their signature. */
export async function generateContractPdf(contract: SignedContract): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width;
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;

  // --- Header band ---
  doc.rect(0, 0, pageWidth, 110).fill(GREEN);
  const logo = loadLogoBuffer();
  if (logo) {
    doc.image(logo, marginX, 20, { width: 68, height: 68 });
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#ffffff")
    .text("Afric", marginX + 82, 32, { continued: true, lineBreak: false })
    .fillColor(GOLD)
    .text("Akani", { lineBreak: false });
  doc
    .fillColor(GOLD)
    .font("Helvetica")
    .fontSize(9)
    .text("AkaGestSoft — Contrat de prestation de services", marginX + 82, 58, { width: 300 });
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("CONTRAT", marginX, 40, { width: contentWidth, align: "right" });

  let y = 132;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(`N° ${contract.id}`, marginX, y);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Signé le ${new Date(contract.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      marginX,
      y + 18
    );
  y += 44;

  // --- Client / cahier des charges ---
  doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).lineWidth(1).stroke();
  y += 10;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(GREEN).text("CAHIER DES CHARGES", marginX, y);
  y = doc.y + 10;

  const colWidth = (contentWidth - 20) / 2;
  const rightX = marginX + colWidth + 20;
  const leftBottom = addField(doc, marginX, y, colWidth, "CLIENT", contract.clientName);
  const rightBottom = addField(doc, rightX, y, colWidth, "ENTREPRISE", contract.companyName || "—");
  y = Math.max(leftBottom, rightBottom);

  const leftBottom2 = addField(doc, marginX, y, colWidth, "E-MAIL", contract.clientEmail);
  const rightBottom2 = addField(doc, rightX, y, colWidth, "TÉLÉPHONE", contract.clientPhone);
  y = Math.max(leftBottom2, rightBottom2);

  y = addField(doc, marginX, y, contentWidth, "SERVICE(S) SOUHAITÉ(S)", contract.services.join(", "));

  const leftBottom3 = addField(doc, marginX, y, colWidth, "BUDGET ESTIMÉ", contract.budget || "Non précisé");
  const rightBottom3 = addField(doc, rightX, y, colWidth, "DÉLAI SOUHAITÉ", contract.timeline || "Non précisé");
  y = Math.max(leftBottom3, rightBottom3);

  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GOLD).text("DESCRIPTION DU BESOIN", marginX, y, { width: contentWidth });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(contract.projectDescription || "—", marginX, doc.y + 1, { width: contentWidth });
  y = doc.y + 10;

  if (contract.notes) {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GOLD).text("PRÉCISIONS COMPLÉMENTAIRES", marginX, y, { width: contentWidth });
    doc.font("Helvetica").fontSize(10).fillColor(INK).text(contract.notes, marginX, doc.y + 1, { width: contentWidth });
    y = doc.y + 10;
  }

  // --- Contract text (own page, since it's typically long) ---
  doc.addPage();
  y = 50;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(GREEN).text("TEXTE DU CONTRAT ACCEPTÉ PAR LE CLIENT", marginX, y);
  y = doc.y + 12;
  doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(contract.contractTextSnapshot, marginX, y, {
    width: contentWidth,
    align: "left",
    lineGap: 2,
  });
  y = doc.y + 24;

  // --- Signature ---
  if (y > doc.page.height - 160) {
    doc.addPage();
    y = 50;
  }
  doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).stroke();
  y += 14;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD).text("SIGNATURE ÉLECTRONIQUE DU CLIENT", marginX, y);
  y = doc.y + 8;

  const signatureBuffer = decodeSignature(contract.signatureDataUrl);
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, marginX, y, { width: 220, height: 90, fit: [220, 90] });
      y += 96;
    } catch {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("(Signature illisible)", marginX, y);
      y += 20;
    }
  }
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(
      `Signé électroniquement par ${contract.clientName} le ${new Date(contract.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      marginX,
      y,
      { width: contentWidth }
    );

  // --- Footer ---
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(
      "AkaGestSoft — contact@africakani.com · WhatsApp +1 514 867 3738",
      marginX,
      doc.page.height - 60,
      { width: contentWidth, align: "center" }
    );

  doc.end();
  return finished;
}
