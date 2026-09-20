import Link from "next/link";
import Image from "next/image";
import { MapPin, Mail, Phone } from "lucide-react";
import { Container } from "./container";
import { FreeShippingFooterLink } from "./free-shipping-footer-link";
import { ProductRequestCard } from "@/components/shop/product-request-modal";

const LINKS = [
  { href: "/notre-histoire#benin", label: "Bénin & Afrique de l'Ouest" },
  { href: "/notre-histoire#diaspora", label: "Diaspora — Canada" },
];

export function Footer() {
  return (
    <footer className="bg-brand-green-dark text-ivory/90">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo/medallion.png"
              alt="AfricAkani"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full"
            />
            <div>
              <span className="font-brand text-2xl font-bold text-ivory">
                Afric<span className="text-brand-gold-light">Akani</span>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ivory/60">
                Boutique · Produits naturels
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ivory/70">
            L&rsquo;Afrique, c&rsquo;est bon. Produits naturels et halal
            d&rsquo;Afrique de l&rsquo;Ouest, livrés du Bénin au Canada.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-gold-light">
            La maison
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/notre-histoire" className="hover:text-brand-gold-light">
                Notre histoire
              </Link>
            </li>
            <li>
              <FreeShippingFooterLink />
            </li>
            {LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-brand-gold-light">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-gold-light">
            Contact
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-light" />
              <span>Cotonou, Bénin</span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-light" />
              <a href="mailto:contact@africakani.com" className="hover:text-brand-gold-light">
                contact@africakani.com
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-light" />
              <a
                href="https://wa.me/15148673738"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-gold-light"
              >
                WhatsApp +1 514 867 3738
              </a>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4">
            <Image
              src="/logo/medallion.png"
              alt="AfricAkani"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full"
            />
            <div>
              <p className="text-sm font-bold text-brand-gold-light">
                Le cœur de l&rsquo;opération
              </p>
              <p className="text-sm text-ivory/70">Cotonou — Bénin</p>
            </div>
          </div>

          <ProductRequestCard />
        </div>
      </Container>

      <div>
        <Container>
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--color-gold) 20%, var(--color-green) 50%, var(--color-gold) 80%, transparent 100%)",
              boxShadow: "0 0 8px 0 rgba(201, 150, 44, 0.35)",
            }}
          />
        </Container>
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-center text-xs text-ivory/60 sm:flex-row">
          <span>© 2026 AfricAkani</span>
          <Link href="/admin" className="text-[11px] text-ivory/35 hover:text-ivory/60">
            Administration
          </Link>
        </Container>
      </div>
    </footer>
  );
}
