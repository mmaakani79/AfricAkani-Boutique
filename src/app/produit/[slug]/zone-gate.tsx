"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MapPinOff } from "lucide-react";
import { useZone } from "@/context/zone-context";
import { ZONES } from "@/data/zones";
import { isSoldInZone, zonesSoldIn } from "@/lib/zone-visibility";
import type { ZoneId } from "@/lib/types";

/** Shows the product page only in a zone where the product is sold. Anywhere
 *  else — typically a link opened from another zone — the visitor gets a clear
 *  message with a way to change zone or go back to the shop, never an error or
 *  an empty page.
 *
 *  Until the browser's remembered zone has been read, the page is shown as the
 *  server rendered it (search engines and slow connections get the full page);
 *  the choice is made as soon as the zone is known. */
export function ProductZoneGate({
  productName,
  prices,
  bypass = false,
  children,
}: {
  productName: string;
  prices: Record<ZoneId, number | null>;
  /** Admin preview of a product that is sold nowhere. */
  bypass?: boolean;
  children: ReactNode;
}) {
  const { zoneId, zone, setZoneId, zoneHydrated } = useZone();
  const holder = { prices };

  if (bypass || !zoneHydrated || isSoldInZone(holder, zoneId)) return <>{children}</>;

  const soldIn = zonesSoldIn(holder);

  return (
    <div
      data-testid="zone-unavailable"
      className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"
    >
      <MapPinOff className="mx-auto h-10 w-10 text-brand-gold" aria-hidden />
      <h1 className="mt-3 font-brand text-2xl font-bold text-brand-green-dark">
        Non disponible dans votre zone
      </h1>
      <p className="mt-2 text-sm text-ink/70">
        « {productName} » n&rsquo;est pas vendu dans la zone de livraison
        actuelle ({zone.label}).
      </p>
      {soldIn.length > 0 && (
        <>
          <p className="mt-3 text-sm text-ink/70">Il est disponible pour :</p>
          <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {soldIn.map((id) => (
              <button
                key={id}
                type="button"
                data-testid={`switch-zone-${id}`}
                onClick={() => setZoneId(id)}
                className="min-h-11 rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark"
              >
                Passer à la zone {ZONES[id].label}
              </button>
            ))}
          </div>
        </>
      )}
      <Link
        href="/catalogue"
        className="mt-5 inline-flex min-h-11 items-center rounded-full border border-brand-green px-5 py-2.5 text-sm font-bold text-brand-green hover:bg-ivory"
      >
        Retourner à la boutique
      </Link>
    </div>
  );
}
