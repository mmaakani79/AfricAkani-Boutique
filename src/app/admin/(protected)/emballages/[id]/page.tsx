import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPackagingTypeById } from "@/lib/packaging-types-db";
import { PackagingTypeForm } from "../packaging-type-form";
import { updatePackagingTypeAction } from "../actions";

export const metadata: Metadata = {
  title: "Modifier le type d'emballage — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditPackagingTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const packagingType = await getPackagingTypeById(id);
  if (!packagingType) notFound();

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Modifier « {packagingType.name} »
      </h1>
      <PackagingTypeForm
        packagingType={packagingType}
        action={updatePackagingTypeAction.bind(null, id)}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
