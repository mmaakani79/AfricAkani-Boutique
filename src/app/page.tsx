import Link from "next/link";
import { Leaf, Truck, ShieldCheck, Globe2 } from "lucide-react";
import { getAllCategories } from "@/lib/categories-db";
import { getAllProducts } from "@/lib/products-db";
import { toPublicProduct } from "@/lib/public-product";
import { ZoneCategorySection, ZoneFeaturedSection } from "@/components/shop/zone-sections";
import { categoryZones, publiclyListed } from "@/lib/zone-visibility";
import { HeroCollage } from "@/components/shop/hero-collage";
import { Container } from "@/components/layout/container";
import { FreeShippingCardText } from "@/components/shop/free-shipping-card-text";

const REASSURANCE = [
  {
    icon: Truck,
    title: "Livraison gratuite",
    // The visitor's own threshold, read from Réglages (see the component).
    text: <FreeShippingCardText />,
  },
  {
    icon: ShieldCheck,
    title: "Halal vérifié",
    text: "Statut clair sur chaque produit",
  },
  {
    icon: Leaf,
    title: "Naturel & authentique",
    text: "Sélection premium",
  },
  {
    icon: Globe2,
    title: "Afrique & Canada",
    text: "Trois zones, une boutique",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const categories = await getAllCategories();
  const featuredCategories = categories.filter((c) => c.featuredHome);
  // What the public may ever see (sold in at least one zone). Which of it a
  // visitor sees depends on their zone, decided in the browser.
  const listed = publiclyListed(await getAllProducts());
  const featuredProducts = listed.filter((p) => p.featured).map(toPublicProduct);
  const zonesByCategory = categoryZones(listed);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden pb-24 pt-20 sm:pb-28 sm:pt-28">
        <HeroCollage />
        <Container className="relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold-light shadow-sm backdrop-blur-md">
              <Leaf className="h-3.5 w-3.5" /> Naturel · Halal · Premium
            </span>
            <h1 className="mt-6 font-brand text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              L&rsquo;Afrique, <br className="hidden sm:block" />
              <span className="text-brand-gold-bright">c&rsquo;est bon.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-ivory/85 sm:text-lg">
              Produits naturels et halal, et sélection généraliste utile au
              quotidien. AfricAkani vous livre en Afrique de l&rsquo;Ouest, au Canada et aux États-Unis.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/catalogue"
                className="rounded-full bg-brand-gold px-7 py-3 text-sm font-bold text-brand-green-dark shadow-lg transition-transform hover:scale-[1.03]"
              >
                Découvrir la boutique →
              </Link>
              <Link
                href="/notre-histoire"
                className="rounded-full border border-white/70 bg-transparent px-7 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Notre histoire
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Reassurance — straddles the hero's bottom edge */}
      <div className="relative z-10 -mt-8 sm:-mt-9">
        <Container>
          <div
            id="livraison"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
          >
            {REASSURANCE.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-md"
              >
                <Icon className="h-5 w-5 shrink-0 text-brand-green" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-bold text-brand-green-dark">
                    {title}
                  </p>
                  <p className="truncate text-[11px] text-ink/55">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* Rayons phares */}
      <ZoneCategorySection categories={featuredCategories} zonesByCategory={zonesByCategory} />

      {/* Produits mis en avant */}
      <ZoneFeaturedSection products={featuredProducts} />
    </div>
  );
}
