import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { ZONES, formatPrice } from "@/data/zones";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "./order-labels";
import { formatOrderAddress, type OrderDetail } from "./orders-db";

const GREEN = "#0e5a44";
const GOLD = "#c9962c";
const INK = "#1c1c1a";
const MUTED = "#6b6b66";
const LINE = "#e5ded0";

/** PDFKit's standard fonts use WinAnsi encoding, which has no glyph for the
 *  narrow no-break space (U+202F) that `toLocaleString("fr-FR")` uses as a
 *  thousands separator — swap it for a plain space so amounts render correctly. */
function money(value: string): string {
  return value.replace(/[  ]/g, " ");
}

function loadLogoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "logo", "medallion.png"));
  } catch {
    return null;
  }
}

/** Renders a one-page PDF invoice for the given order, with the AfricAkani logo in the header. */
export async function generateInvoicePdf(order: OrderDetail): Promise<Buffer> {
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
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("AfricAkani", marginX + 82, 32, { lineBreak: false });
  doc
    .fillColor(GOLD)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Boutique de produits naturels et halal d'Afrique de l'Ouest",
      marginX + 82,
      58,
      { width: 260 }
    );
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("FACTURE", marginX, 40, { width: contentWidth, align: "right" });

  // --- Meta row (left) + bill-to block (right) ---
  let y = 132;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(`N° ${order.id}`, marginX, y);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Date : ${new Date(order.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}`,
      marginX,
      y + 18
    )
    .text(`Zone : ${ZONES[order.zoneId].label}`, marginX, y + 32)
    .text(
      `Statut : ${ORDER_STATUS_LABELS[order.status]} — ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
      marginX,
      y + 46
    );

  const billX = marginX + contentWidth / 2 + 10;
  const billWidth = contentWidth / 2 - 10;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(GOLD)
    .text("FACTURÉ À", billX, y, { width: billWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(INK)
    .text(order.customerName, billX, y + 14, { width: billWidth });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(formatOrderAddress(order), billX, y + 30, { width: billWidth })
    .text(order.customerPhone, billX, doc.y + 2, { width: billWidth });
  if (order.customerEmail) {
    doc.text(order.customerEmail, billX, doc.y + 2, { width: billWidth });
  }

  y = Math.max(y + 70, doc.y + 20);

  // --- Items table ---
  doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).lineWidth(1).stroke();
  y += 10;
  const colProduct = marginX;
  const colQty = marginX + contentWidth - 220;
  const colPrice = marginX + contentWidth - 150;
  const colTotal = marginX + contentWidth - 70;
  const nameWidth = colQty - colProduct - 10;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(GOLD)
    .text("PRODUIT", colProduct, y)
    .text("QTÉ", colQty, y, { width: 40, align: "right" })
    .text("PRIX UNIT.", colPrice, y, { width: 70, align: "right" })
    .text("TOTAL", colTotal, y, { width: 70, align: "right" });
  y += 16;
  doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).stroke();
  y += 8;

  for (const item of order.items) {
    if (y > doc.page.height - 200) {
      doc.addPage();
      y = 50;
    }
    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    const rowHeight = Math.max(doc.heightOfString(item.productName, { width: nameWidth }), 14) + 4;
    doc.text(item.productName, colProduct, y, { width: nameWidth });
    doc.text(String(item.quantity), colQty, y, { width: 40, align: "right" });
    doc.text(money(formatPrice(item.unitPrice, order.zoneId)), colPrice, y, { width: 70, align: "right" });
    doc.text(money(formatPrice(item.lineTotal, order.zoneId)), colTotal, y, { width: 70, align: "right" });
    y += rowHeight;
  }

  y += 6;
  doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).stroke();
  y += 12;

  // --- Totals ---
  const totalsX = marginX + contentWidth - 200;
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  doc.text("Sous-total", totalsX, y, { width: 120 });
  doc.text(money(formatPrice(order.subtotal, order.zoneId)), totalsX + 120, y, { width: 80, align: "right" });
  y += 16;
  doc.text("Livraison", totalsX, y, { width: 120 });
  doc.text(
    order.shippingFee > 0 ? money(formatPrice(order.shippingFee, order.zoneId)) : "Gratuite",
    totalsX + 120,
    y,
    { width: 80, align: "right" }
  );
  y += 20;
  doc.moveTo(totalsX, y).lineTo(totalsX + 200, y).strokeColor(LINE).stroke();
  y += 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(GREEN)
    .text("TOTAL", totalsX, y, { width: 120 })
    .text(money(formatPrice(order.subtotal + order.shippingFee, order.zoneId)), totalsX + 120, y, {
      width: 80,
      align: "right",
    });

  y += 36;

  if (order.paymentMethod === "mobile_money" && order.mobileMoneyOperator) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `Paiement : Mobile Money (${order.mobileMoneyOperator})${
          order.mobileMoneyTransactionId ? ` — transaction ${order.mobileMoneyTransactionId}` : ""
        }`,
        marginX,
        y,
        { width: contentWidth }
      );
  }

  // --- Footer ---
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(
      "AfricAkani — Cotonou, Bénin · contact@africakani.com · WhatsApp +1 514 867 3738",
      marginX,
      doc.page.height - 60,
      { width: contentWidth, align: "center" }
    );

  doc.end();
  return finished;
}
