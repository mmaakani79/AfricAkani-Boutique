import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Leaf, ShieldCheck, Heart, Globe2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Notre histoire — AfricAkani",
  description:
    "Africa + Akani : l'histoire d'une boutique née d'une conviction simple, du Bénin au Canada.",
};

const VALUES = [
  {
    icon: Leaf,
    title: "Naturel",
    text: "Des produits authentiques, sélectionnés pour leur qualité réelle.",
  },
  {
    icon: ShieldCheck,
    title: "Halal vérifié",
    text: "Un statut clair sur chaque produit : certifié, à vérifier, ou non applicable.",
  },
  {
    icon: Heart,
    title: "Confiance",
    text: "Une maison de qualité, pas une épicerie low-cost.",
  },
  {
    icon: Globe2,
    title: "Pont",
    text: "Du Bénin au Canada, une boutique pour ceux d'ici et de là-bas.",
  },
];

export default function NotreHistoire() {
  return (
    <div>
      {/* Bandeau d'introduction */}
      <section className="bg-brand-green-dark px-4 py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-brand text-3xl font-extrabold sm:text-5xl">
            Africa + <span className="text-brand-gold-light">Akani.</span>
          </h1>
          <p className="mt-2 font-brand text-xl text-brand-gold-light sm:text-2xl">
            L&rsquo;Afrique, c&rsquo;est bon.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-sm text-ivory/85 sm:text-base">
            AfricAkani fusionne « Africa » et le prénom de son fondateur,
            Akani. Une boutique de produits naturels et halal d&rsquo;Afrique
            de l&rsquo;Ouest, pensée pour ceux qui y vivent et pour la
            diaspora — du Bénin au Canada.
          </p>
          <Link
            href="#histoire"
            className="mt-7 inline-block rounded-full bg-brand-gold px-7 py-3 text-sm font-bold text-brand-green-dark hover:bg-brand-gold-light"
          >
            Lire notre histoire →
          </Link>
        </div>
      </section>

      {/* Photo + histoire */}
      <section id="histoire">
        <div className="relative flex h-[480px] items-end sm:h-[600px]">
          <Image
            src="/photos/notre-histoire.webp"
            alt="Femme en tenue wax vert et or, en extérieur au coucher du soleil"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_25%]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold-light">
              Notre histoire
            </p>
            <h2 className="mt-2 font-brand text-3xl font-extrabold text-white sm:text-5xl">
              Africa + Akani
            </h2>
            <p className="font-brand text-xl text-white/90 sm:text-2xl">
              L&rsquo;Afrique, c&rsquo;est bon.
            </p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 py-12 text-ink/80">
          <p className="text-lg font-medium text-brand-green-dark">
            AfricAkani naît d&rsquo;une conviction simple : l&rsquo;Afrique
            regorge de trésors naturels, et ces trésors méritent une vitrine
            à la hauteur de leur qualité.
          </p>
          <p className="mt-5">
            Le nom fusionne « Africa » et le prénom du fondateur, Akani — un
            nom qui évoque « l&rsquo;Afrique, c&rsquo;est bon ». C&rsquo;est
            la devise de la maison : chaque produit qui porte notre nom doit
            transmettre confiance, authenticité et qualité premium.
          </p>
          <p className="mt-5">
            Notre mission : rendre accessibles les produits naturels et
            halal d&rsquo;Afrique de l&rsquo;Ouest, accompagnés d&rsquo;une
            sélection généraliste plus large — pour les foyers de Cotonou,
            Porto-Novo et Abomey-Calavi comme pour la diaspora ouest-africaine
            au Canada et aux États-Unis.
          </p>
        </div>
      </section>

      {/* Valeurs — même photo réutilisée en filigrane discret */}
      <section id="benin" className="relative overflow-hidden bg-white px-4 py-14">
        <Image
          src="/photos/notre-histoire.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_25%] opacity-[0.08] grayscale"
        />
        <div className="absolute inset-0 bg-white/85" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-brand-green/10 bg-ivory/95 p-5"
            >
              <Icon className="h-7 w-7 text-brand-green" />
              <p className="mt-3 text-base font-bold text-brand-green-dark">
                {title}
              </p>
              <p className="mt-1 text-sm text-ink/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Clôture */}
      <section
        id="diaspora"
        className="bg-brand-green-dark px-4 py-16 text-center text-white"
      >
        <h2 className="font-brand text-3xl font-bold sm:text-4xl">
          Découvrez la maison
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ivory/85 sm:text-base">
          Des produits naturels, halal, et utiles au quotidien — livrés
          gratuitement.
        </p>
        <Link
          href="/catalogue"
          className="mt-7 inline-block rounded-full bg-brand-gold px-7 py-3 text-sm font-bold text-brand-green-dark hover:bg-brand-gold-light"
        >
          Explorer le catalogue →
        </Link>
      </section>
    </div>
  );
}
