"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useZone } from "@/context/zone-context";
import { getCategoryById } from "@/data/categories";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "@/components/shop/photo-placeholder";
import { Container } from "@/components/layout/container";
import { computeShippingFee } from "@/lib/shipping-calc";

export default function PanierPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const { zone, format } = useZone();

  const remaining = Math.max(zone.freeShippingThreshold - subtotal, 0);
  const progress = Math.min(
    100,
    Math.round((subtotal / zone.freeShippingThreshold) * 100)
  );
  const shippingFee = computeShippingFee(subtotal, zone);
  const total = subtotal + shippingFee;

  if (items.length === 0) {
    return (
      <Container className="py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <ShoppingCart
            className="h-12 w-12 text-brand-green/40"
            strokeWidth={1.75}
          />
          <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
            Votre panier est vide
          </h1>
          <p className="text-sm text-ink/60">
            Parcourez le catalogue pour trouver des produits naturels et
            halal, et bien plus encore.
          </p>
          <Link
            href="/catalogue"
            className="mt-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
          >
            Découvrir la boutique →
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <h1 className="font-brand text-3xl font-bold text-brand-green-dark">
        Mon panier
      </h1>

      <div className="mt-6 rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-brand-green-dark">
          {progress >= 100 ? (
            <span>Livraison gratuite débloquée 🎉</span>
          ) : (
            <span>
              Plus que {format(remaining)} pour débloquer la livraison
              gratuite
            </span>
          )}
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ivory">
          <div
            className="h-full rounded-full bg-brand-gold transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-6 divide-y divide-brand-green/10 rounded-2xl bg-white">
        {items.map((item) => {
          const category = getCategoryById(item.product.categoryId);
          const Icon = category ? CATEGORY_ICONS[category.id] : undefined;
          return (
            <div key={item.product.id} className="flex items-center gap-4 p-4">
              <Link
                href={`/produit/${item.product.slug}`}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"
              >
                <PhotoPlaceholder
                  seed={category?.photoSeed ?? "emerald"}
                  icon={Icon}
                  className="relative h-full w-full"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/produit/${item.product.slug}`}
                  className="line-clamp-1 text-sm font-semibold text-brand-green-dark hover:text-brand-green"
                >
                  {item.product.name}
                </Link>
                <p className="text-xs text-ink/50">{item.product.unit}</p>
              </div>

              <div className="flex items-center rounded-full border border-brand-green/20">
                <button
                  type="button"
                  aria-label="Diminuer la quantité"
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity - 1)
                  }
                  className="p-2 text-brand-green-dark"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-bold">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Augmenter la quantité"
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity + 1)
                  }
                  className="p-2 text-brand-green-dark"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <span className="w-20 shrink-0 text-right text-sm font-bold text-ink">
                {format(item.lineTotal)}
              </span>

              <button
                type="button"
                aria-label="Retirer du panier"
                onClick={() => removeItem(item.product.id)}
                className="shrink-0 rounded-full p-2 text-ink/40 hover:bg-ivory hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-end gap-4 rounded-2xl bg-white p-5">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex items-center justify-between text-ink/70">
            <span>Sous-total</span>
            <span>{format(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-ink/70">
            <span>Livraison</span>
            <span>{shippingFee > 0 ? format(shippingFee) : "Gratuite"}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold text-brand-green-dark">
            <span>Total</span>
            <span>{format(total)}</span>
          </div>
        </div>
        <Link
          href="/commande"
          className="rounded-full bg-brand-green px-7 py-3 text-sm font-bold text-ivory hover:bg-brand-green-dark"
        >
          Passer la commande →
        </Link>
      </div>
    </Container>
  );
}
