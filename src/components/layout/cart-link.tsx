"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cart-context";

export function CartLink() {
  const { itemCount } = useCart();

  return (
    <Link
      href="/panier"
      aria-label="Voir le panier"
      className="cart-link relative flex items-center justify-center rounded-full border border-brand-green/20 bg-white p-2.5 text-brand-green hover:border-brand-green/40"
    >
      <ShoppingCart
        className="cart-link__icon h-4 w-4"
        strokeWidth={1.75}
        aria-hidden
      />
      {itemCount > 0 && (
        <span
          key={itemCount}
          className="cart-badge-pop absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[11px] font-bold text-brand-green-dark"
        >
          {itemCount}
        </span>
      )}
    </Link>
  );
}
