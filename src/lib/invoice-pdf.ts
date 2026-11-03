import { ZONES, formatPrice } from "@/data/zones";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "./order-labels";
import { formatOrderAddress, type OrderDetail } from "./orders-db";
import {
  GOLD,
  GREEN,
  INK,
  LINE,
  MARGIN_X,
  MUTED,
  contentWidthOf,
  drawInvoiceEnding,
  drawInvoiceHeader,
  ENDING_RESERVED,
  money,
  newInvoiceDoc,
} from "./invoice-pdf-parts";

/** An item name longer than this many lines is cut with "…": one very long line must not push the invoice onto a second page. */
const MAX_ITEM_NAME_LINES = 3;
const MAX_ADDRESS_LINES = 4;

/** Renders a one-page PDF invoice for the given order, with the AfricAkani logo in the header. */
export async function generateInvoicePdf(order: OrderDetail): Promise<Buffer> {
  const { doc, finished } = newInvoiceDoc();

  const marginX = MARGIN_X;
  const contentWidth = contentWidthOf(doc);

  drawInvoiceHeader(doc, "FACTURE");

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
  // Each block is cut at a few lines ("…") so a very long name or address cannot grow the page.
  const clampedText = (text: string, x: number, top: number, width: number, maxLines: number): number => {
    const lineHeight = doc.currentLineHeight(true);
    const height = Math.min(doc.heightOfString(text, { width }), lineHeight * maxLines);
    doc.text(text, x, top, { width, height, ellipsis: true });
    return top + height + 2;
  };
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
  let billY = clampedText(order.customerName, billX, y + 14, billWidth, 2);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  billY = clampedText(formatOrderAddress(order), billX, billY + 2, billWidth, MAX_ADDRESS_LINES);
  billY = clampedText(order.customerPhone, billX, billY, billWidth, 1);
  if (order.customerEmail) billY = clampedText(order.customerEmail, billX, billY, billWidth, 1);

  y = Math.max(y + 70, billY + 20);

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
    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    const lineHeight = doc.currentLineHeight(true);
    const nameHeight = Math.min(doc.heightOfString(item.productName, { width: nameWidth }), lineHeight * MAX_ITEM_NAME_LINES);
    const rowHeight = Math.max(nameHeight, 14) + 4;
    // Room for this row, the totals, the payment line and the bottom of the page.
    if (y + rowHeight > doc.page.height - ENDING_RESERVED - 160) {
      doc.addPage();
      y = 50;
      doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    }
    doc.text(item.productName, colProduct, y, { width: nameWidth, height: nameHeight, ellipsis: true });
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
  } else if (order.paymentMethod === "stripe") {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text("Paiement : Carte bancaire (Stripe)", marginX, y, { width: contentWidth });
  } else if (order.paymentMethod === "paypal") {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `Paiement : PayPal${order.paypalCaptureId ? ` — capture ${order.paypalCaptureId}` : ""}`,
        marginX,
        y,
        { width: contentWidth }
      );
  }

  // --- Footer line (with the site) and slogan ---
  drawInvoiceEnding(doc);

  doc.end();
  return finished;
}
