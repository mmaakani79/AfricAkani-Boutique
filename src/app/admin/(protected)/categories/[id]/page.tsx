import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryById } from "@/lib/categories-db";
import { CategoryForm } from "../category-form";
import { updateCategoryAction } from "../actions";

export const metadata: Metadata = {
  title: "Modifier la catégorie — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryById(id);
  if (!category) notFound();

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Modifier « {category.name} »
      </h1>
      <CategoryForm
        category={category}
        action={updateCategoryAction.bind(null, id)}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
