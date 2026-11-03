// What the PDF invoices of the shop have in common: the green header band with the AfricAkani logo,
// the footer line with the site, the slogan, and the centered concluding block. Used by the order
// invoice (invoice-pdf.ts) and the service-file invoice (service-invoice-pdf.ts), so both look the same.

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { SUPPLIER_ADDRESS } from "./business-info";
import { RECEIPT_SLOGAN } from "./receipt-slogan";

export type PdfDoc = InstanceType<typeof PDFDocument>;

export const GREEN = "#0e5a44";
export const GOLD = "#c9962c";
export const INK = "#1c1c1a";
export const MUTED = "#6b6b66";
export const LINE = "#e5ded0";

export const MARGIN_X = 50;

/** The footer line of every invoice: the shop, its site and its contacts. */
export const INVOICE_FOOTER_LINE = `AfricAkani — ${SUPPLIER_ADDRESS} · africakani.com · contact@africakani.com · WhatsApp +1 514 867 3738`;

/** Room kept at the bottom of every page for the footer line and the slogan. */
export const ENDING_RESERVED = 100;

/** PDFKit's standard fonts use WinAnsi encoding, which has no glyph for the
 *  narrow no-break space (U+202F) that `toLocaleString("fr-FR")` uses as a
 *  thousands separator — swap it for a plain space so amounts render correctly. */
export function money(value: string): string {
  // The minus sign (U+2212) has no glyph either: a plain hyphen stands for it.
  return value.replace(/[\u202f\u00a0]/g, " ").replace(/\u2212/g, "-");
}

function loadLogoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "logo", "medallion.png"));
  } catch {
    return null;
  }
}

export function newInvoiceDoc(): { doc: PdfDoc; finished: Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN_X });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, finished };
}

export function contentWidthOf(doc: PdfDoc): number {
  return doc.page.width - MARGIN_X * 2;
}

/** Green header band: logo, "AfricAkani", tagline, and the title ("FACTURE") on the right. */
export function drawInvoiceHeader(doc: PdfDoc, title = "FACTURE"): void {
  const pageWidth = doc.page.width;
  const contentWidth = contentWidthOf(doc);
  doc.rect(0, 0, pageWidth, 110).fill(GREEN);
  const logo = loadLogoBuffer();
  if (logo) {
    doc.image(logo, MARGIN_X, 20, { width: 68, height: 68 });
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#ffffff")
    .text("Afric", MARGIN_X + 82, 32, { continued: true, lineBreak: false })
    .fillColor(GOLD)
    .text("Akani", { lineBreak: false });
  doc
    .fillColor(GOLD)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Boutique généraliste africaine — produits naturels, mode, technologie et bien plus, livrés en Afrique de l'Ouest, au Canada et aux États-Unis.",
      MARGIN_X + 82,
      58,
      { width: 260 }
    );
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(title, MARGIN_X, 40, { width: contentWidth, align: "right" });
}

/** Lines of text centered across the page, from `y`; returns the y below them. A "" is a small gap. */
export function drawCenteredClosing(doc: PdfDoc, lines: string[], y: number, fontSize = 9): number {
  const width = contentWidthOf(doc);
  doc.font("Helvetica").fontSize(fontSize).fillColor(MUTED);
  for (const line of lines) {
    if (line === "") {
      y += 6;
      continue;
    }
    const h = doc.heightOfString(line, { width, align: "center" });
    doc.text(line, MARGIN_X, y, { width, align: "center" });
    y += h + 2;
  }
  return y;
}

/**
 * The bottom of the LAST page: the footer line (with the site), then the slogan, both centered.
 * They sit inside the bottom margin, so the margin is lifted first: otherwise PDFKit would open a
 * second page just for them.
 */
export function drawInvoiceEnding(doc: PdfDoc): void {
  const width = contentWidthOf(doc);
  doc.page.margins.bottom = 0;
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(INVOICE_FOOTER_LINE, MARGIN_X, doc.page.height - 62, { width, align: "center", lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(GREEN)
    .text(RECEIPT_SLOGAN, MARGIN_X, doc.page.height - 42, { width, align: "center", lineBreak: false });
}

/** Opens a new page when the next block (`needed` points high) would run into the reserved bottom area. */
export function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  if (y + needed > doc.page.height - ENDING_RESERVED) {
    doc.addPage();
    return 50;
  }
  return y;
}
