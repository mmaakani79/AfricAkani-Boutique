"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Extra gallery photos beyond the cover image — same upload mechanism as
 *  ImageUploadField, but keeps a list instead of a single URL. */
export function GalleryUploadField({
  defaultValue,
}: {
  defaultValue?: string[];
}) {
  const [urls, setUrls] = useState<string[]>(defaultValue ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setError(null);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Format non supporté. Utilisez des images JPG, PNG ou WebP.");
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError("Une image dépasse 5 Mo maximum.");
        continue;
      }
      setUploading(true);
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
        });
        newUrls.push(blob.url);
      } catch {
        setError(
          "Le téléversement a échoué. Réessayez, ou contactez l'administrateur technique si le problème persiste."
        );
      }
    }
    setUploading(false);
    if (newUrls.length > 0) {
      setUrls((prev) => [...prev, ...newUrls]);
    }
  }

  function removeAt(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        Photos supplémentaires (galerie)
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {urls.map((url) => (
        <input key={url} type="hidden" name="galleryImages" value={url} />
      ))}

      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for */}
            <img
              src={url}
              alt={`Photo galerie ${i + 1}`}
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
              aria-label="Retirer cette photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-green/25 text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-[10px] font-semibold">Ajouter</span>
        </button>
      </div>
      <p className="mt-1 text-[11px] text-ink/40">
        Affichées avec l&rsquo;image principale dans la galerie de la fiche produit.
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
