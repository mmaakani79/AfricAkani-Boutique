"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The shop's banner, header and footer are not shown on a client's private payment
// page (/paiement-service/...): nothing else of the site must be visible there.
// The children are server-rendered; this only decides whether to show them.
const BARE_PREFIX = "/paiement-service";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === BARE_PREFIX || pathname.startsWith(`${BARE_PREFIX}/`)) return null;
  return <>{children}</>;
}
