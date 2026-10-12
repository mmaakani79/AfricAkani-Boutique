"use client";

import { useZone } from "@/context/zone-context";
import { freeShippingCardText } from "@/lib/shipping-banner";

/** Sub-title of the home page's "Livraison gratuite" card: the threshold of the
 *  visitor's zone, from Réglages (never a figure written in the code). Until
 *  Réglages has answered — or if it can't — it says "Dès le seuil de votre zone". */
export function FreeShippingCardText() {
  const { zoneId, liveShipping } = useZone();
  return <>{freeShippingCardText(zoneId, liveShipping)}</>;
}
