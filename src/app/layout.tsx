import type { Metadata } from "next";
import { Playfair_Display, Work_Sans } from "next/font/google";
import "./globals.css";
import { ZoneProvider } from "@/context/zone-context";
import { CartProvider } from "@/context/cart-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShippingBanner } from "@/components/layout/shipping-banner";

const playfair = Playfair_Display({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const workSans = Work_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AfricAkani — L'Afrique, c'est bon.",
  description:
    "Boutique en ligne de produits naturels et halal d'Afrique de l'Ouest, et sélection généraliste utile au quotidien. Livraison gratuite dès un certain montant, du Bénin au Canada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${playfair.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ivory text-ink font-sans">
        <ZoneProvider>
          <CartProvider>
            <ShippingBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </ZoneProvider>
      </body>
    </html>
  );
}
