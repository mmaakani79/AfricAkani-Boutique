import type { Metadata } from "next";
import {
  Store,
  Globe2,
  LayoutDashboard,
  Laptop,
  ShieldCheck,
  MessageCircle,
  Mail,
  ArrowRight,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { GoldLink } from "./gold-link";

export const metadata: Metadata = {
  title: "Nos services — AfricAkani",
  description:
    "Boutique en ligne, site web, application de gestion, matériel et cybersécurité pour les commerçants d'Afrique de l'Ouest et de la diaspora.",
  alternates: { canonical: "/services" },
};

const EMAIL = "contact@africakani.com";

const WHATSAPP_HREF = `https://wa.me/15148673738?text=${encodeURIComponent(
  "Bonjour, je souhaite créer ma boutique en ligne"
)}`;

const SERVICES = [
  {
    icon: Store,
    title: "Boutique en ligne",
    text: "Votre catalogue, votre panier, vos paiements et vos commandes, dans une boutique à votre image.",
  },
  {
    icon: Globe2,
    title: "Site web",
    text: "Un site clair et rapide pour présenter votre activité et être trouvé.",
  },
  {
    icon: LayoutDashboard,
    title: "Application de gestion",
    text: "Suivez vos ventes, vos stocks et vos clients depuis votre téléphone ou votre ordinateur.",
  },
  {
    icon: Laptop,
    title: "Matériel et achats",
    text: "Choix d'ordinateurs, de téléphones et d'équipements adaptés à votre activité et à votre budget, avec un accompagnement pour acheter au meilleur prix.",
  },
  {
    icon: ShieldCheck,
    title: "Réseau et cybersécurité",
    text: "Conseils pour installer et sécuriser votre réseau, vos comptes et vos données. Installation sur place au Canada.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "On échange",
    text: "Vous nous parlez de votre activité et de vos produits.",
  },
  {
    number: "2",
    title: "On construit",
    text: "Nous créons votre boutique avec vos produits.",
  },
  {
    number: "3",
    title: "Vous vendez",
    text: "Nous vous formons à la gestion, puis nous restons à vos côtés.",
  },
];

const REASONS = [
  "Pensé pour l'Afrique de l'Ouest et la diaspora, avec des prix distincts par zone (FCFA, CAD, USD).",
  "Simple à gérer : on ajoute ses produits soi-même ou avec un fichier Excel.",
  "Une preuve vivante : la boutique AfricAkani que vous visitez a été créée par nos soins.",
];

export default function ServicesPage() {
  return (
    <div>
      <section className="bg-brand-green-dark py-16 text-center text-white sm:py-24">
        <Container>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-gold-bright sm:text-sm">
            Services
          </p>
          <h1 className="mx-auto mt-2 max-w-2xl font-brand text-3xl font-extrabold sm:text-5xl">
            Créons votre boutique en ligne
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-ivory/85 sm:text-base">
            Du produit à la commande, nous concevons des outils simples pour
            les commerçants d&rsquo;Afrique et de la diaspora.
          </p>
        </Container>
      </section>

      <section>
        <Container className="py-14">
          <h2 className="text-center font-brand text-2xl font-bold text-brand-green-dark sm:text-3xl">
            Nos services
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ icon: Icon, title, text }) => (
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
          <p className="mt-6 text-center text-xs text-ink/50">
            Conseils à distance : Bénin, Afrique de l&rsquo;Ouest et Canada.
            Installation sur place : Canada.
          </p>
        </Container>
      </section>

      <section className="bg-white">
        <Container className="py-14">
          <h2 className="text-center font-brand text-2xl font-bold text-brand-green-dark sm:text-3xl">
            Comment ça marche&nbsp;?
          </h2>
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
            {STEPS.map(({ number, title, text }) => (
              <div key={number} className="text-center sm:text-left">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-green-dark font-brand text-base font-extrabold text-brand-gold-bright">
                  {number}
                </span>
                <p className="mt-3 text-base font-bold text-brand-green-dark">
                  {title}
                </p>
                <p className="mt-1 text-sm text-ink/60">{text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-14">
          <h2 className="text-center font-brand text-2xl font-bold text-brand-green-dark sm:text-3xl">
            Pourquoi nous choisir&nbsp;?
          </h2>
          <ul className="mx-auto mt-8 max-w-2xl space-y-4">
            {REASONS.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-ink/70 shadow-sm"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold"
                  aria-hidden
                />
                {reason}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="bg-brand-green-dark py-16 text-center text-white">
        <Container>
          <h2 className="font-brand text-3xl font-bold sm:text-4xl">
            Parlons de votre projet&nbsp;!
          </h2>
          <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <GoldLink href={WHATSAPP_HREF} external>
              <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> Écrire sur WhatsApp
            </GoldLink>
            <GoldLink href={`mailto:${EMAIL}`}>
              <Mail className="h-[18px] w-[18px]" aria-hidden /> Envoyer un e-mail
            </GoldLink>
          </div>
          <p className="mt-5 text-sm text-white">{EMAIL}</p>

          <div className="mx-auto mt-8 w-full max-w-xl border-t border-white/20 pt-6">
            <p className="text-base font-semibold text-white">Projet déjà cadré ?</p>
            <div className="mx-auto mt-4 flex w-full max-w-sm flex-col sm:max-w-none sm:flex-row sm:justify-center">
              <GoldLink href="/contrat">
                Remplir le cahier des charges et signer le contrat
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </GoldLink>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
