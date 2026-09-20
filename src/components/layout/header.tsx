import Link from "next/link";
import Image from "next/image";
import { ZoneSwitcher } from "./zone-switcher";
import { SearchButton } from "./search-button";
import { CartLink } from "./cart-link";
import { MobileMenu } from "./mobile-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-green/10 bg-ivory/95 backdrop-blur">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-3 px-4 md:h-28">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo/wordmark.webp"
            alt="AfricAkani — Boutique · Produits naturels"
            width={2000}
            height={600}
            priority
            className="h-16 w-auto md:h-20"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-brand-green-dark md:flex">
          <Link href="/catalogue" className="hover:text-brand-gold">
            Catalogue
          </Link>
          <Link href="/notre-histoire" className="hover:text-brand-gold">
            Notre histoire
          </Link>
          <Link href="/compte" className="hover:text-brand-gold">
            Mon compte
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:block">
            <ZoneSwitcher />
          </div>
          <SearchButton />
          <CartLink />
          <MobileMenu />
        </div>
      </div>
      <div className="border-t border-brand-green/10 bg-white px-4 py-2 sm:hidden">
        <ZoneSwitcher />
      </div>
    </header>
  );
}
