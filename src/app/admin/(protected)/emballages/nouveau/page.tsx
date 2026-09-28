import type { Metadata } from "next";
import { PackagingTypeForm } from "../packaging-type-form";
import { createPackagingTypeAction } from "../actions";

export const metadata: Metadata = {
  title: "Nouveau type d'emballage — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export default function NewPackagingTypePage() {
  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Nouveau type d&rsquo;emballage
      </h1>
      <PackagingTypeForm
        action={createPackagingTypeAction}
        submitLabel="Créer le type d'emballage"
      />
    </div>
  );
}
