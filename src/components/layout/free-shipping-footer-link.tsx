"use client";

import Link from "next/link";
import { useZone } from "@/context/zone-context";
import { freeShippingLineText } from "@/lib/shipping-banner";

export function FreeShippingFooterLink() {
  const { zoneId, liveShipping } = useZone();
  return (
    <Link href="/#livraison" className="hover:text-brand-gold-light">
      {freeShippingLineText(zoneId, liveShipping)}
    </Link>
  );
}
