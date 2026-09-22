"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageUploadField({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format non supporté. Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Image trop lourde (5 Mo maximum).");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });
      setUrl(blob.url);
    } catch {
      setError("Le téléversement a échoué. Merci de réessayer.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        Image du produit
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <input type="hidden" name="image" value={url} />

      {url ? (
        <div className="flex items-center gap-4 rounded-xl border border-brand-green/20 bg-ivory p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed local/remote host next/image can be pre-configured for */}
          <img
            src={url}
            alt="Aperçu du produit"
            className="h-24 w-24 shrink-0 rounded-lg object-cover"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-brand-green/20 bg-white px-4 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
            >
              {uploading ? "Téléversement…" : "Remplacer l’image"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setUrl("")}
              className="flex items-center gap-1 rounded-full border border-red-200 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Supprimer l&rsquo;image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors disabled:opacity-60 ${
            dragOver
              ? "border-brand-green bg-brand-green/5"
              : "border-brand-green/25 bg-ivory hover:bg-brand-green/5"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
          ) : (
            <ImagePlus className="h-6 w-6 text-brand-green" />
          )}
          <span className="text-sm font-semibold text-brand-green-dark">
            {uploading
              ? "Téléversement en cours…"
              : "Glissez-déposez une image, ou cliquez pour en choisir une"}
          </span>
          <span className="text-xs text-ink/50">JPG, PNG ou WebP — 5 Mo maximum</span>
        </button>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
