import type { Metadata } from "next";
import { CategoryForm } from "../category-form";
import { createCategoryAction } from "../actions";

export const metadata: Metadata = {
  title: "Nouvelle catégorie — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Nouvelle catégorie
      </h1>
      <CategoryForm action={createCategoryAction} submitLabel="Créer la catégorie" />
    </div>
  );
}
