// The four legal pages, word for word as validated by the owner (final version).
// Do not reword: a unit test compares this file with the validated text kept in
// tests/fixtures/pages-legales.md. Inline markup is limited to [text](url) links;
// e-mail addresses become mailto links when displayed.

export type LegalBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export interface LegalPage {
  /** URL path, e.g. "/mentions-legales". */
  path: string;
  /** Page title (also used in the footer). */
  title: string;
  blocks: LegalBlock[];
}

const MENTIONS_LEGALES: LegalPage = {
  path: "/mentions-legales",
  title: "Mentions légales",
  blocks: [
    { type: "p", text: "AfricAkani est une boutique en ligne exploitée depuis le Québec, Canada." },
    {
      type: "ul",
      items: [
        "Nom commercial : AfricAkani",
        "Adresse : Québec, Canada",
        "Courriel : info@africakani.com",
        "Site : [www.africakani.com](https://www.africakani.com)",
        "Responsable de la protection des renseignements personnels : info@africakani.com",
      ],
    },
    {
      type: "p",
      text: "Les produits d'hygiène ou de bien-être vendus sur ce site ne remplacent pas l'avis d'un médecin ou d'un pharmacien.",
    },
  ],
};

const CONFIDENTIALITE: LegalPage = {
  path: "/confidentialite",
  title: "Politique de confidentialité",
  blocks: [
    {
      type: "p",
      text: "AfricAkani protège vos renseignements personnels et ne collecte que ceux dont elle a besoin pour traiter votre commande. Dernière mise à jour : octobre 2026.",
    },
    { type: "h2", text: "Renseignements collectés" },
    {
      type: "ul",
      items: [
        "Pour une commande : nom, adresse de livraison, courriel, téléphone, produits commandés et montant.",
        "Pour un paiement par carte ou PayPal : le paiement est traité par Stripe ou PayPal. AfricAkani ne voit ni ne conserve votre numéro de carte.",
        "Pour un paiement Mobile Money (Bénin) : le numéro et la référence de la transaction servent à confirmer le paiement.",
        "Mesure d'audience : nombre de visites et pages consultées, sans cookies et sans suivi d'un site à l'autre. Les adresses sont nettoyées : aucun numéro de commande ni mot de recherche n'est transmis.",
        "Dans votre navigateur : votre panier, votre zone et l'historique de vos commandes sont gardés sur votre appareil, pas sur nos serveurs.",
      ],
    },
    { type: "h2", text: "Utilisation" },
    {
      type: "p",
      text: "Vos renseignements servent à traiter et livrer votre commande, vous envoyer vos confirmations et le suivi, répondre à vos questions, et respecter nos obligations légales et comptables. Nous ne vendons pas vos renseignements.",
    },
    { type: "h2", text: "Partage avec des tiers" },
    {
      type: "p",
      text: "Nous les communiquons seulement aux services nécessaires : hébergement du site et mesure d'audience (Vercel), base de données (Neon), paiements (Stripe, PayPal), envoi de courriels (Resend), et transporteurs ou fournisseurs chargés de préparer et livrer votre commande (nom, adresse et téléphone). Certains de ces prestataires sont situés hors du Québec, notamment aux États-Unis.",
    },
    { type: "h2", text: "Conservation" },
    {
      type: "p",
      text: "Nous gardons les renseignements de commande le temps nécessaire à nos obligations comptables et légales, généralement jusqu'à six ans, puis nous les supprimons ou les anonymisons.",
    },
    { type: "h2", text: "Vos droits" },
    {
      type: "p",
      text: "Vous pouvez demander l'accès à vos renseignements, leur correction ou leur suppression, et retirer votre consentement. Écrivez à info@africakani.com : nous répondons dans un délai de 30 jours. Si un incident de confidentialité risque de vous causer un préjudice sérieux, nous vous en informerons.",
    },
    { type: "h2", text: "Responsable" },
    {
      type: "p",
      text: "La personne responsable de la protection des renseignements personnels est joignable à info@africakani.com.",
    },
  ],
};

const CONDITIONS_DE_VENTE: LegalPage = {
  path: "/conditions-de-vente",
  title: "Conditions de vente",
  blocks: [
    { type: "p", text: "En passant commande sur africakani.com, vous acceptez les conditions suivantes." },
    { type: "h2", text: "Produits et prix" },
    {
      type: "ul",
      items: [
        "Les prix sont affichés selon votre zone : francs CFA (Bénin et Afrique de l'Ouest), dollars canadiens (Canada) ou dollars américains (États-Unis).",
        "Un produit n'est vendu que dans les zones où un prix est affiché. S'il est indiqué « Non disponible dans votre zone », il ne peut pas être commandé depuis cette zone.",
        "Les prix peuvent changer sans préavis. Le prix applicable est celui affiché au moment de la commande.",
        "Les photos sont fournies à titre indicatif : l'aspect réel peut légèrement varier.",
      ],
    },
    { type: "h2", text: "Commande" },
    {
      type: "ul",
      items: [
        "La commande est confirmée lorsque le paiement est accepté (ou, pour une commande par WhatsApp, lorsque nous la confirmons).",
        "Nous pouvons refuser ou annuler une commande en cas d'indisponibilité du produit ou d'erreur de prix manifeste. Vous êtes alors remboursé intégralement.",
      ],
    },
    { type: "h2", text: "Paiement" },
    {
      type: "ul",
      items: [
        "Canada et États-Unis : carte bancaire (Stripe) ou PayPal.",
        "Bénin : Mobile Money.",
        "Commande possible aussi par WhatsApp, au +229 01 62 33 33 35 (Bénin) : les conditions de paiement vous sont alors précisées.",
      ],
    },
    { type: "h2", text: "Produits d'hygiène et de bien-être" },
    {
      type: "p",
      text: "Ces produits ne remplacent pas un médicament ni l'avis d'un médecin ou d'un pharmacien. Lisez la notice avant usage. En cas de doute ou de symptômes persistants, consultez un professionnel de santé.",
    },
    { type: "h2", text: "Contact" },
    { type: "p", text: "Pour toute question : info@africakani.com." },
  ],
};

const LIVRAISON_RETOURS: LegalPage = {
  path: "/livraison-retours",
  title: "Livraison et retours",
  blocks: [
    { type: "h2", text: "Livraison" },
    {
      type: "ul",
      items: [
        "Délai estimé : 1 à 2 semaines après la confirmation de la commande, pour le Bénin, le Canada et les États-Unis. Ce délai est une estimation et peut varier selon le transporteur et la douane.",
        "Frais : un forfait de livraison par zone est affiché au moment de la commande. La livraison est offerte au-delà d'un montant d'achat, indiqué sur le site pour chaque zone.",
        "Vous recevez un courriel de confirmation et, dès qu'il existe, un numéro de suivi.",
        "Les droits de douane ou taxes d'importation éventuels dans le pays de livraison peuvent rester à votre charge.",
      ],
    },
    { type: "h2", text: "Retours" },
    {
      type: "ul",
      items: [
        "Vous avez 2 semaines (14 jours) après la réception pour demander un retour. Écrivez à info@africakani.com avant d'expédier quoi que ce soit.",
        "Le produit doit être inutilisé, dans son emballage d'origine.",
        "Les frais d'expédition du retour sont à la charge du client.",
        "Produits non repris : les produits d'hygiène et de santé (par exemple le spray nasal) ne sont ni repris ni échangés, pour des raisons d'hygiène.",
      ],
    },
    { type: "h2", text: "Remboursement" },
    {
      type: "ul",
      items: [
        "Une fois le produit retourné et vérifié, le remboursement est effectué dans un délai de 2 semaines, par le même moyen de paiement que votre achat.",
        "Les frais de livraison initiaux ne sont pas remboursés, sauf erreur de notre part.",
      ],
    },
    { type: "h2", text: "Produit endommagé ou erroné" },
    {
      type: "p",
      text: "Si vous recevez un produit endommagé, défectueux ou différent de votre commande, contactez-nous dans les 7 jours suivant la réception, avec des photos. Nous proposons alors un remplacement ou un remboursement, sans frais de retour pour vous.",
    },
  ],
};

export const LEGAL_PAGES = {
  mentionsLegales: MENTIONS_LEGALES,
  confidentialite: CONFIDENTIALITE,
  conditionsDeVente: CONDITIONS_DE_VENTE,
  livraisonRetours: LIVRAISON_RETOURS,
} as const;

/** In footer order. */
export const LEGAL_PAGE_LIST: readonly LegalPage[] = [
  MENTIONS_LEGALES,
  CONFIDENTIALITE,
  CONDITIONS_DE_VENTE,
  LIVRAISON_RETOURS,
];

/** Plain text of a piece of content: [text](url) reduced to "text". */
export function plainText(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

/** The first sentence-like block of a page, used as its meta description (no new wording). */
export function legalDescription(page: LegalPage): string {
  for (const block of page.blocks) {
    if (block.type === "p") return plainText(block.text);
    if (block.type === "ul") return plainText(block.items[0]);
  }
  return page.title;
}
