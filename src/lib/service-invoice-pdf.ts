// The invoice of a service file (a client's payment file), as a PDF: same look as the order invoice
// (green AfricAkani header, "FACTURE", number, date, "Facturé à"), with the file's payments and what is
// still to pay. Only what the client already sees on their private page: the private link itself is
// NEVER written in the PDF (it is not even known here: only its fingerprint is stored).

import type { ServiceAccountFull } from "./service-accounts-db";
import { ADJUSTMENT_KIND_LABELS, SCHEDULE_STATUS_LABELS, todayInBenin } from "./service-account-math";
import { dateFr, fcfa } from "./service-format";
import { CONTRACT_REFUND_LINE, PROVIDER_LINE, isDepositReceipt } from "./service-receipt";
import { PAYMENT_METHOD_LABELS } from "./service-validation";
import {
  GOLD,
  GREEN,
  INK,
  LINE,
  MARGIN_X,
  MUTED,
  contentWidthOf,
  drawCenteredClosing,
  drawInvoiceEnding,
  drawInvoiceHeader,
  ensureSpace,
  money,
  newInvoiceDoc,
} from "./invoice-pdf-parts";

/** The title line under the header: "Facture" with what is left to pay, never suggesting that everything is paid. */
export function serviceInvoiceHeadline(remaining: number): string {
  return remaining > 0 ? `Facture — solde restant à payer : ${fcfa(remaining)}` : "Facture — dossier soldé";
}

export function serviceInvoiceFilename(accountId: string): string {
  return `facture-${accountId.replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
}

const OVERDUE = "échéance dépassée";

export async function generateServiceInvoicePdf(
  full: ServiceAccountFull,
  today: string = todayInBenin()
): Promise<Buffer> {
  const { account, state, payments, adjustments } = full;
  const { doc, finished } = newInvoiceDoc();
  const contentWidth = contentWidthOf(doc);
  const marginX = MARGIN_X;

  /** One line of text, cut with "…" rather than wrapped: the rows keep a fixed height. */
  const cell = (text: string, x: number, y: number, width: number, opts: { align?: "left" | "right"; bold?: boolean; size?: number; color?: string } = {}) => {
    doc
      .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.size ?? 9)
      .fillColor(opts.color ?? INK)
      .text(money(text), x, y, { width, height: doc.currentLineHeight(true), ellipsis: true, align: opts.align ?? "left", lineBreak: false });
  };
  const sectionTitle = (title: string, y: number): number => {
    y = ensureSpace(doc, y, 60);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD).text(title, marginX, y, { width: contentWidth });
    y += 14;
    doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).strokeColor(LINE).lineWidth(1).stroke();
    return y + 8;
  };

  drawInvoiceHeader(doc, "FACTURE");

  // --- Number, date and merchant (left) + bill-to block (right) ---
  let y = 132;
  const clientName = account.clientName.trim() || account.merchantName;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(`N° ${account.id}`, marginX, y, { width: contentWidth / 2, lineBreak: false, ellipsis: true });
  cell(`Date : ${dateFr(today)}`, marginX, y + 18, contentWidth / 2 - 10, { color: MUTED });
  cell(`Dossier ouvert le ${dateFr(account.createdAt.slice(0, 10))}`, marginX, y + 32, contentWidth / 2 - 10, { color: MUTED });
  cell(`Boutique : ${account.merchantName}`, marginX, y + 46, contentWidth / 2 - 10, { color: MUTED });

  const billX = marginX + contentWidth / 2 + 10;
  const billWidth = contentWidth / 2 - 10;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD).text("FACTURÉ À", billX, y, { width: billWidth });
  cell(clientName, billX, y + 14, billWidth, { bold: true, size: 10 });
  let billY = y + 30;
  for (const line of [account.clientEmail, account.clientPhone]) {
    if (!line) continue;
    cell(line, billX, billY, billWidth, { color: MUTED });
    billY += 13;
  }
  y = Math.max(y + 70, billY + 12);

  // --- Headline: Facture + what is left to pay ---
  const unpaid = state.remaining > 0;
  doc.roundedRect(marginX, y, contentWidth, 30, 6).fill(unpaid ? "#f6ecd2" : "#dcefe6");
  cell(serviceInvoiceHeadline(state.remaining), marginX + 12, y + 9, contentWidth - 24, { bold: true, size: 12, color: unpaid ? INK : GREEN });
  y += 44;

  // --- Confirmed payments ---
  y = sectionTitle("PAIEMENTS CONFIRMÉS", y);
  const confirmed = payments
    .filter((p) => p.status === "confirme")
    .sort((a, b) => (a.confirmedAt ?? "").localeCompare(b.confirmedAt ?? "") || a.createdAt.localeCompare(b.createdAt));
  const col = { date: marginX, kind: marginX + 85, method: marginX + 160, receipt: marginX + 290, amount: marginX + contentWidth - 90 };
  if (confirmed.length === 0) {
    cell("Aucun paiement confirmé pour le moment.", marginX, y, contentWidth, { color: MUTED });
    y += 18;
  } else {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    cell("DATE", col.date, y, 80, { bold: true, size: 8, color: MUTED });
    cell("DÉSIGNATION", col.kind, y, 70, { bold: true, size: 8, color: MUTED });
    cell("MOYEN", col.method, y, 125, { bold: true, size: 8, color: MUTED });
    cell("REÇU N°", col.receipt, y, 120, { bold: true, size: 8, color: MUTED });
    cell("MONTANT", col.amount, y, 90, { bold: true, size: 8, color: MUTED, align: "right" });
    y += 16;
    for (const p of confirmed) {
      y = ensureSpace(doc, y, 20);
      const method = PAYMENT_METHOD_LABELS[p.method] ?? p.method;
      cell(dateFr(p.paidOn ?? (p.confirmedAt ?? p.createdAt).slice(0, 10)), col.date, y, 80);
      cell(isDepositReceipt(payments, p.id) ? "Acompte" : "Paiement", col.kind, y, 70);
      cell(p.mmOperator ? `${method} (${p.mmOperator})` : method, col.method, y, 125);
      cell(p.id, col.receipt, y, 120);
      cell(fcfa(p.amount), col.amount, y, 90, { align: "right", bold: true });
      y += 17;
    }
  }
  if (state.pending > 0) {
    y = ensureSpace(doc, y, 20);
    cell(`Paiement en attente de confirmation, non compté ci-dessus : ${fcfa(state.pending)}.`, marginX, y + 2, contentWidth, { color: MUTED, size: 8.5 });
    y += 18;
  }
  y += 10;

  // --- Adjustments (reductions, corrections, refunds): never hidden ---
  if (adjustments.length > 0) {
    y = sectionTitle("AJUSTEMENTS", y);
    for (const a of adjustments) {
      y = ensureSpace(doc, y, 20);
      const sign = a.kind === "reduction" ? "− " : a.kind === "remboursement" ? "" : a.amount > 0 ? "+ " : "− ";
      cell(`${ADJUSTMENT_KIND_LABELS[a.kind]} — ${a.reason}`, marginX, y, contentWidth - 130);
      cell(`${sign}${fcfa(Math.abs(a.amount))}${a.kind === "remboursement" ? " remboursés" : ""}`, marginX + contentWidth - 130, y, 130, { align: "right", bold: true });
      y += 17;
    }
    y += 10;
  }

  // --- Totals ---
  y = ensureSpace(doc, y, 130);
  const totalsX = marginX + contentWidth - 250;
  const row = (label: string, value: string, opts: { bold?: boolean; color?: string; size?: number } = {}) => {
    cell(label, totalsX, y, 150, { color: opts.color ?? MUTED, bold: opts.bold, size: opts.size ?? 10 });
    cell(value, totalsX + 150, y, 100, { align: "right", bold: opts.bold, color: opts.color ?? INK, size: opts.size ?? 10 });
    y += 16;
  };
  row("Prix total", fcfa(account.total));
  if (state.reductions > 0) row("Réductions", `− ${fcfa(state.reductions)}`);
  if (state.corrections !== 0) row("Corrections", `${state.corrections > 0 ? "+ " : "− "}${fcfa(Math.abs(state.corrections))}`);
  if (state.reductions > 0 || state.corrections !== 0) row("Prix total ajusté", fcfa(state.adjustedTotal));
  row("Acompte prévu", fcfa(Math.min(account.deposit, Math.max(0, state.adjustedTotal))));
  if (state.refunds > 0) row("Remboursements", `− ${fcfa(state.refunds)}`);
  row("Total payé", fcfa(Math.max(0, state.paid)));
  doc.moveTo(totalsX, y).lineTo(totalsX + 250, y).strokeColor(LINE).stroke();
  y += 6;
  row("Reste à payer", fcfa(state.remaining), { bold: true, color: GREEN, size: 12 });
  if (state.overpaid > 0) row("Trop-perçu", fcfa(state.overpaid), { size: 9 });
  y += 14;

  // --- Next due date and the tranches still to come ---
  y = sectionTitle("PROCHAINE ÉCHÉANCE ET TRANCHES À VENIR", y);
  const next = state.next;
  if (!next) {
    cell("Aucune tranche à venir : le dossier est soldé.", marginX, y, contentWidth, { color: MUTED });
    y += 18;
  } else {
    const what = next.kind === "deposit" ? "Acompte" : next.label || `Tranche ${next.position}`;
    const when = next.dueDate ? (next.dueDate < today ? OVERDUE : dateFr(next.dueDate)) : "à régler maintenant";
    cell(`Prochaine échéance : ${what} — ${when} — ${fcfa(next.amount)}`, marginX, y, contentWidth, { bold: true });
    y += 20;
    const upcoming = state.schedule.filter((l) => l.status !== "paye");
    for (const l of upcoming) {
      y = ensureSpace(doc, y, 20);
      const label = l.kind === "deposit" ? "Acompte" : l.label || `Tranche ${l.position}`;
      const date = l.dueDate ? (l.dueDate < today ? OVERDUE : dateFr(l.dueDate)) : "à régler maintenant";
      cell(label, marginX, y, 170);
      cell(date, marginX + 175, y, 130, { color: l.status === "en_retard" ? "#b91c1c" : MUTED });
      cell(SCHEDULE_STATUS_LABELS[l.status], marginX + 310, y, 80, { color: l.status === "en_retard" ? "#b91c1c" : MUTED });
      cell(fcfa(l.amount - l.paid), marginX + contentWidth - 90, y, 90, { align: "right", bold: true });
      y += 17;
    }
  }
  y += 12;

  // --- Concluding block (centered), then the footer line with the site and the slogan ---
  y = ensureSpace(doc, y, 50);
  y = drawCenteredClosing(doc, [PROVIDER_LINE, CONTRACT_REFUND_LINE], y);

  drawInvoiceEnding(doc);
  doc.end();
  return finished;
}
