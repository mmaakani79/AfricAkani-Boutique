import { RECEIPT_SLOGAN, withReceiptSlogan } from "./receipt-slogan";
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_DISPLAY_HEIGHT,
  EMAIL_LOGO_DISPLAY_WIDTH,
} from "./email-logo";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps the same plain-text lines used for an e-mail's `text` body into a
 * branded HTML version with the AfricAkani logo in the header — single
 * source of truth for content, so the two versions never drift apart.
 *
 * The logo is referenced by Content-ID (cid:), never by a web address: the
 * sender attaches it to the message (see withInlineLogo in email-logo.ts). The
 * header is white because the logo's name is dark green and gold: unreadable on
 * the green brand colour.
 */
export function renderEmailHtml(
  subject: string,
  lines: string[],
  { receipt = false, closing = [] }: { receipt?: boolean; closing?: string[] } = {}
): string {
  // Receipts and confirmations end with the slogan, below the existing mentions.
  const sloganRow = receipt
    ? `
            <tr>
              <td data-receipt-slogan="1" align="center" style="padding:18px 20px 22px;background:#0e5a44;color:#ffffff;font-size:18px;line-height:1.4;font-weight:bold;">
                ${escapeHtml(RECEIPT_SLOGAN)}
              </td>
            </tr>`
    : "";

  // The closing block of a receipt (provider line, refund terms, tracking sentence…) is centered, like
  // the footer line and the slogan; the detail above it stays left-aligned.
  const closingBlock =
    receipt && closing.length > 0
      ? `
                <div data-receipt-closing="1" align="center" style="margin-top:18px;text-align:center;">
${closing
  .map((line) =>
    line === ""
      ? '                  <div style="height:10px;line-height:10px;font-size:1px;">&nbsp;</div>'
      : `                  <p style="margin:0 0 6px;text-align:center;white-space:pre-line;">${escapeHtml(line)}</p>`
  )
  .join("\n")}
                </div>`
      : "";
  const footerAlign = receipt ? 'align="center" ' : "";
  const footerStyle = receipt ? "text-align:center;" : "";

  const body = lines
    .map((line) =>
      line === ""
        ? '<div style="height:14px;line-height:14px;font-size:1px;">&nbsp;</div>'
        : `<p style="margin:0 0 6px;white-space:pre-line;">${escapeHtml(line)}</p>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1e9;font-family:Georgia,'Times New Roman',serif;color:#1c1c1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1e9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="height:6px;line-height:6px;font-size:1px;background:#0e5a44;">&nbsp;</td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:22px 28px 18px;border-bottom:3px solid #e0b65a;" align="center">
                <img
                  src="cid:${EMAIL_LOGO_CID}"
                  alt="AfricAkani"
                  width="${EMAIL_LOGO_DISPLAY_WIDTH}"
                  height="${EMAIL_LOGO_DISPLAY_HEIGHT}"
                  style="display:block;margin:0 auto;width:${EMAIL_LOGO_DISPLAY_WIDTH}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;line-height:1.2;color:#0e5a44;text-align:center;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;font-size:14px;line-height:1.6;">
                ${body}${closingBlock}
              </td>
            </tr>
            <tr>
              <td ${footerAlign}style="padding:16px 28px 24px;border-top:1px solid #e0b65a55;${footerStyle}">
                <p style="margin:0;font-size:11px;color:#1c1c1a99;${footerStyle}">
                  AfricAkani — Boutique généraliste africaine — produits naturels, mode,
                  technologie et bien plus, livrés en Afrique de l'Ouest, au Canada et aux États-Unis.
                </p>
              </td>
            </tr>${sloganRow}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * The e-mail body of a RECEIPT or CONFIRMATION sent to a client: `lines` is the detail (left-aligned),
 * `closing` the concluding block that comes right before the slogan (centered in the HTML). The plain
 * text and the HTML both end with the slogan. Every such e-mail is built with this, never with
 * `renderEmailHtml` alone.
 */
export function renderReceiptEmail(
  subject: string,
  lines: string[],
  closing: string[] = []
): { text: string; html: string } {
  const all = closing.length > 0 ? [...lines, "", ...closing] : lines;
  return {
    text: withReceiptSlogan(all).join("\n"),
    html: renderEmailHtml(subject, lines, { receipt: true, closing }),
  };
}
