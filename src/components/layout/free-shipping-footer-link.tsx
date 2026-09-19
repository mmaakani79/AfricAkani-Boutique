"use client";

import Link from "next/link";
import { useZone } from "@/context/zone-context";

export function FreeShippingFooterLink() {
  const { zone, format } = useZone();
  return (
    <Link href="/#livraison" className="hover:text-brand-gold-light">
      Livraison gratuite dès {format(zone.freeShippingThreshold)}
    </Link>
  );
}
