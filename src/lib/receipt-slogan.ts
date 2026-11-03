// The slogan every receipt and confirmation sent to a client ends with. ONE place: e-mails, pages,
// the invoice PDF and the WhatsApp messages all read it from here (see `renderReceiptEmail`,
// `ReceiptSlogan`, `generateInvoicePdf`). A new receipt must use one of them; `tests/receipt-slogan.test.ts`
// checks that the known receipts do.

export const RECEIPT_SLOGAN = "Votre Satisfaction, Notre Réussite !";

/** Plain-text lines of a receipt, with the slogan as the very last line (added once, never twice). */
export function withReceiptSlogan(lines: string[]): string[] {
  const kept = [...lines];
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
  if (kept[kept.length - 1] === RECEIPT_SLOGAN) return kept;
  return [...kept, "", RECEIPT_SLOGAN];
}

/** A one-line text (WhatsApp message…) ending with the slogan. */
export function withReceiptSloganText(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(RECEIPT_SLOGAN) ? trimmed : `${trimmed} ${RECEIPT_SLOGAN}`;
}
