"use client";

import { Truck } from "lucide-react";
import { useZone } from "@/context/zone-context";
import { useCart } from "@/context/cart-context";

export function ShippingBanner() {
  const { zone, format } = useZone();
  const { subtotal } = useCart();

  const remaining = Math.max(zone.freeShippingThreshold - subtotal, 0);
  const reached = remaining === 0 && subtotal > 0;

  return (
    <div className="bg-brand-green-dark text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold sm:text-sm">
        <Truck className="h-4 w-4 shrink-0" aria-hidden />
        {reached ? (
          <span>
            Livraison gratuite débloquée — merci pour votre commande !
          </span>
        ) : (
          <span>
            Livraison gratuite dès{" "}
            <span className="text-brand-gold-light">
              {format(zone.freeShippingThreshold)}
            </span>{" "}
            — plus que{" "}
            <span className="text-brand-gold-light">{format(remaining)}</span>{" "}
            pour en profiter
          </span>
        )}
      </div>
    </div>
  );
}
