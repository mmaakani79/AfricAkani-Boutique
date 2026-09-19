"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useZone } from "@/context/zone-context";

const SHOP_LINKS = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/catalogue?halal=oui", label: "Produits halal" },
  { href: "/panier", label: "Mon panier" },
  { href: "/compte", label: "Mes commandes" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { zone, format } = useZone();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="flex items-center justify-center rounded-full border border-brand-green/20 bg-white p-2.5 text-brand-green md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <div className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col gap-8 overflow-y-auto bg-ivory px-6 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Image
                src="/logo/medallion.png"
                alt="AfricAkani"
                width={40}
                height={40}
                className="rounded-full"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-full p-2 text-ink/60 hover:bg-white"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-brand-gold">
                Boutique
              </p>
              {SHOP_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-brand-green-dark hover:bg-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-col gap-1">
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-brand-gold">
                La maison
              </p>
              <Link
                href="/notre-histoire"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-brand-green-dark hover:bg-white"
              >
                Notre histoire
              </Link>
              <span className="rounded-lg px-3 py-2.5 text-base font-medium text-brand-green-dark">
                Livraison gratuite dès {format(zone.freeShippingThreshold)}
              </span>
              <Link
                href="/notre-histoire#benin"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-brand-green-dark hover:bg-white"
              >
                Bénin & Afrique de l&rsquo;Ouest
              </Link>
              <Link
                href="/notre-histoire#diaspora"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-brand-green-dark hover:bg-white"
              >
                Diaspora — Canada
              </Link>
            </nav>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
