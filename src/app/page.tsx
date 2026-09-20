import Link from "next/link";
import { Leaf, Truck, ShieldCheck, Globe2 } from "lucide-react";
import { CATEGORIES } from "@/data/categories";
import { getFeaturedProducts } from "@/lib/products-db";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryCard } from "@/components/shop/category-card";
import { HeroCollage } from "@/components/shop/hero-collage";
import { Container } from "@/components/layout/container";

const REASSURANCE = [
  {
    icon: Truck,
    title: "Livraison gratuite",
    text: "Dès le seuil de votre zone",
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
  const featuredCategories = CATEGORIES.filter((c) => c.featuredHome);
  const featuredProducts = await getFeaturedProducts();

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
              quotidien. Livrés chez vous, gratuitement.
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
      <Container className="pb-14 pt-16">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-brand-gold">
          Nos rayons phares
        </p>
        <h2 className="mt-2 text-center font-brand text-3xl font-bold text-brand-green-dark">
          Le meilleur de la maison
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featuredCategories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>

      {/* Produits mis en avant */}
      <section className="bg-white py-14">
        <Container>
          <p className="text-center text-xs font-bold uppercase tracking-widest text-brand-gold">
            Sélection
          </p>
          <h2 className="mt-2 text-center font-brand text-3xl font-bold text-brand-green-dark">
            Produits mis en avant
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/catalogue"
              className="rounded-full border border-brand-green px-6 py-3 text-sm font-bold text-brand-green hover:bg-brand-green hover:text-ivory"
            >
              Voir tout le catalogue →
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
