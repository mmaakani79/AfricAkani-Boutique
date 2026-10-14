"use client";

import { X } from "lucide-react";
import { useCart } from "@/context/cart-context";

/** Tells the customer which products left the cart because they are not sold in
 *  the zone they switched to (see the cart context). Shown on the cart and the
 *  checkout, until dismissed. */
export function CartZoneNotice() {
  const { removedNotice, dismissRemovedNotice } = useCart();
  if (!removedNotice) return null;
  const { names, zoneLabel } = removedNotice;

  return (
    <div
      role="status"
      data-testid="cart-zone-notice"
      className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-gold/15 px-4 py-3 text-sm text-brand-green-dark"
    >
      <p className="flex-1">
        <span className="font-bold">
          {names.length > 1
            ? `${names.length} produits ont été retirés de votre panier`
            : "1 produit a été retiré de votre panier"}
        </span>{" "}
        : non disponible{names.length > 1 ? "s" : ""} dans la zone « {zoneLabel} ».
        <span className="mt-1 block text-xs text-ink/70">{names.join(" · ")}</span>
      </p>
      <button
        type="button"
        onClick={dismissRemovedNotice}
        aria-label="Fermer ce message"
        className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/60"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
