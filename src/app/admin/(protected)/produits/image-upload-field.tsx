"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const NOT_CONFIGURED_MESSAGE =
  "Stockage d'images non configuré sur ce déploiement (Vercel Blob). " +
  "Dans le tableau de bord Vercel : Storage → Create Database → Blob, " +
  "puis redéployez. Voir le README pour le détail.";

export function ImageUploadField({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // null = not checked yet, true = ready, false = BLOB_READ_WRITE_TOKEN missing.
  const [storageConfigured, setStorageConfigured] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/upload")
      .then((res) => (res.ok ? res.json() : { configured: true }))
      .then((data: { configured: boolean }) => {
        if (!cancelled) setStorageConfigured(data.configured);
      })
      .catch(() => {
        if (!cancelled) setStorageConfigured(true); // don't block the form on a status-check failure
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(file: File) {
    setError(null);

    if (storageConfigured === false) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
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
      // The SDK discards the server's actual error message on failure (see
      // /api/admin/upload's GET handler comment), so re-check configuration
      // to give a specific cause when we can, rather than always guessing.
      const res = await fetch("/api/admin/upload").catch(() => null);
      const data = res?.ok ? ((await res.json()) as { configured: boolean }) : null;
      if (data && !data.configured) {
        setStorageConfigured(false);
        setError(NOT_CONFIGURED_MESSAGE);
      } else {
        setError(
          "Le téléversement a échoué. Réessayez, ou contactez l'administrateur technique si le problème persiste."
        );
      }
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

      {storageConfigured === false && (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {NOT_CONFIGURED_MESSAGE}
        </p>
      )}

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
