import Link from "next/link";
import type { Category } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "./photo-placeholder";

export function CategoryCard({ category }: { category: Category }) {
  const Icon = CATEGORY_ICONS[category.id];
  return (
    <Link
      href={`/catalogue?categorie=${category.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl"
    >
      <PhotoPlaceholder
        seed={category.photoSeed}
        icon={Icon}
        className="h-full w-full transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="text-lg font-bold text-white">{category.name}</h3>
        <span className="mt-1 inline-block text-sm font-semibold text-brand-gold-light">
          Explorer →
        </span>
      </div>
    </Link>
  );
}
