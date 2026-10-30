// What Vercel Web Analytics is allowed to record. Pure (no React, no network) so
// it can be unit-tested; used as the `beforeSend` of the analytics component.
//
// Two rules:
//  1. Nothing from the admin area or from a client's private payment page is counted.
//  2. Only the page path is kept: everything after "?" (order ids, payment
//     tokens, search words...) and after "#" is cut off before sending. Order
//     numbers travel in addresses such as /suivi?commande=AK-... and
//     /commande/succes?session_id=..., which must never reach a statistics tool.

/** The part of an analytics event this filter reads and rewrites. */
interface UrlEvent {
  url: string;
}

// Areas never counted: the admin, and the clients' private payment pages (their secret
// link is part of the address: it must never reach a statistics tool).
const UNCOUNTED_PREFIXES = ["/admin", "/paiement-service"];

function isAdminPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return UNCOUNTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
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
