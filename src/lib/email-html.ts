import { getSiteUrl } from "./order-config";

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
 */
export function renderEmailHtml(subject: string, lines: string[]): string {
  const logoUrl = `${getSiteUrl()}/logo/medallion.png`;
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
              <td style="background:#0e5a44;padding:22px 28px;" align="center">
                <img
                  src="${logoUrl}"
                  alt="AfricAkani"
                  width="60"
                  height="60"
                  style="display:block;border-radius:50%;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;font-size:14px;line-height:1.6;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #e0b65a55;">
                <p style="margin:0;font-size:11px;color:#1c1c1a99;">
                  AfricAkani — Boutique de produits naturels et halal d&rsquo;Afrique de l&rsquo;Ouest.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
