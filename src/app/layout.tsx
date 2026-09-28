import type { Metadata } from "next";
import { Josefin_Sans, Open_Sans } from "next/font/google";
import "./globals.css";
import { ZoneProvider } from "@/context/zone-context";
import { CartProvider } from "@/context/cart-context";
import { CategoryProvider } from "@/context/category-context";
import { PackagingProvider } from "@/context/packaging-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShippingBanner } from "@/components/layout/shipping-banner";

const josefin = Josefin_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const openSans = Open_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "700"],
});

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
  return (
    <html
      lang="fr"
      className={`${josefin.variable} ${openSans.variable} h-full antialiased`}
    >
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
