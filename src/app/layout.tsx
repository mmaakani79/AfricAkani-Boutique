import type { Metadata } from "next";
import { preload } from "react-dom";
import "./fonts.css";
import "./globals.css";
import { ZoneProvider } from "@/context/zone-context";
import { CartProvider } from "@/context/cart-context";
import { CategoryProvider } from "@/context/category-context";
import { PackagingProvider } from "@/context/packaging-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShippingBanner } from "@/components/layout/shipping-banner";

// The two "latin" files carry every French character: load them right away, as
// next/font did, so text appears directly in the right font (the other ranges
// load on demand, only if a page needs them).
const PRELOADED_FONTS = [
  new URL("./fonts/josefin-sans-latin.woff2", import.meta.url),
  new URL("./fonts/open-sans-latin.woff2", import.meta.url),
];

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.africakani.com"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AfricAkani — L'Afrique, c'est bon.",
  description:
    "Boutique généraliste africaine — produits naturels, mode, technologie et bien plus, livrés du Bénin au Canada et aux États-Unis. Livraison gratuite dès un certain montant.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AfricAkani — L'Afrique, c'est bon.",
    description:
      "Boutique généraliste africaine — produits naturels, mode, technologie et bien plus, livrés du Bénin au Canada et aux États-Unis.",
    url: SITE_URL,
    siteName: "AfricAkani",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  for (const font of PRELOADED_FONTS) {
    preload(font.href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ivory text-ink font-sans">
        <ZoneProvider>
          <CategoryProvider>
            <PackagingProvider>
              <CartProvider>
                <ShippingBanner />
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </CartProvider>
            </PackagingProvider>
          </CategoryProvider>
        </ZoneProvider>
      </body>
    </html>
  );
}
