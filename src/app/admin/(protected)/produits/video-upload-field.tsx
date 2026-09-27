"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Loader2, Video, X } from "lucide-react";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export function VideoUploadField({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format non supporté. Utilisez une vidéo MP4, WebM ou MOV.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Vidéo trop lourde (50 Mo maximum).");
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
      setError(
        "Le téléversement a échoué. Réessayez, ou contactez l'administrateur technique si le problème persiste."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/60">
        Vidéo du produit (optionnelle)
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <input type="hidden" name="videoUrl" value={url} />

      {url ? (
        <div className="flex items-center gap-4 rounded-xl border border-brand-green/20 bg-ivory p-3">
          <video src={url} className="h-24 w-24 shrink-0 rounded-lg bg-black object-cover" muted />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-brand-green/20 bg-white px-4 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
            >
              {uploading ? "Téléversement…" : "Remplacer la vidéo"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setUrl("")}
              className="flex items-center gap-1 rounded-full border border-red-200 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Supprimer la vidéo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-green/25 bg-ivory px-4 py-6 text-center hover:bg-brand-green/5 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
          ) : (
            <Video className="h-6 w-6 text-brand-green" />
          )}
          <span className="text-sm font-semibold text-brand-green-dark">
            {uploading ? "Téléversement en cours…" : "Cliquez pour choisir une vidéo"}
          </span>
          <span className="text-xs text-ink/50">MP4, WebM ou MOV — 50 Mo maximum</span>
        </button>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
