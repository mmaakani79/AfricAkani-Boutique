// What Vercel Web Analytics is allowed to record. Pure (no React, no network) so
// it can be unit-tested; used as the `beforeSend` of the analytics component.
//
// Two rules:
//  1. Nothing from the admin area is counted (/admin and everything under it).
//  2. Only the page path is kept: everything after "?" (order ids, payment
//     tokens, search words...) and after "#" is cut off before sending. Order
//     numbers travel in addresses such as /suivi?commande=AK-... and
//     /commande/succes?session_id=..., which must never reach a statistics tool.

/** The part of an analytics event this filter reads and rewrites. */
interface UrlEvent {
  url: string;
}

const ADMIN_PREFIX = "/admin";

function isAdminPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);
}

/** `null` = do not send this event; otherwise the event with a clean address. */
export function filterAnalyticsEvent<T extends UrlEvent>(event: T): T | null {
  let parsed: URL;
  try {
    // The base only lets relative addresses parse; it never ends up in the result.
    parsed = new URL(event.url, "http://localhost");
  } catch {
    // An address we cannot read is never sent: better one missing page view
    // than one that might carry an identifier.
    return null;
  }

  if (isAdminPath(parsed.pathname)) return null;

  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(event.url);
  const clean = isAbsolute ? `${parsed.origin}${parsed.pathname}` : parsed.pathname;
  return { ...event, url: clean };
}
