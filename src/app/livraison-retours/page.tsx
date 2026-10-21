import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_PAGES, legalDescription } from "@/lib/legal-content";

const page = LEGAL_PAGES.livraisonRetours;

export const metadata: Metadata = {
  title: `${page.title} — AfricAkani`,
  description: legalDescription(page),
  alternates: { canonical: page.path },
};

export default function LivraisonRetoursPage() {
  return <LegalDocument page={page} />;
}
