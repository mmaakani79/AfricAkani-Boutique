"use client";

import { useEffect, useState } from "react";
import { Play, ZoomIn, X } from "lucide-react";
import type { HalalStatus } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "./photo-placeholder";
import { HalalBadge } from "./halal-badge";

type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

/** Product page media viewer — cover photo, extra gallery photos, and an
 *  optional video, with click-to-select thumbnails. The video plays inline
 *  (native <video controls>), never navigating away from the page.
 *
 *  Two extra interactions on top of that: hovering a thumbnail previews it
 *  zoomed-in on the main image without changing the selection, and clicking
 *  the main image opens it full-size in a lightbox. */
export function ProductGallery({
  name,
  image,
  galleryImages = [],
  videoUrl,
  halal,
  placeholderSeed,
  categoryId,
}: {
  name: string;
  image?: string;
  galleryImages?: string[];
  videoUrl?: string;
  halal: HalalStatus;
  placeholderSeed: string;
  /** Looked up client-side against CATEGORY_ICONS — icon components (functions)
   *  can't cross the server → client boundary as a prop. */
  categoryId?: string;
}) {
  const placeholderIcon = categoryId ? CATEGORY_ICONS[categoryId] : undefined;
  const media: MediaItem[] = [
    ...(image ? [{ type: "image" as const, url: image }] : []),
    ...galleryImages.map((url) => ({ type: "image" as const, url })),
    ...(videoUrl ? [{ type: "video" as const, url: videoUrl }] : []),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayIndex = hoverIndex ?? activeIndex;
  const display = media[displayIndex];
  const isHoverPreview = hoverIndex !== null && hoverIndex !== activeIndex;

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  return (
    <div>
      <div
        className={`group relative aspect-square overflow-hidden rounded-2xl bg-ink/5 ${
          display?.type === "image" ? "cursor-zoom-in" : ""
        }`}
        onClick={() => {
          if (display?.type === "image") setLightboxOpen(true);
        }}
      >
        {display ? (
          display.type === "image" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for */}
              <img
                src={display.url}
                alt={name}
                className={`h-full w-full object-cover transition-transform duration-300 ${
                  isHoverPreview ? "scale-110" : "scale-100 group-hover:scale-105"
                }`}
              />
              <span className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ZoomIn className="h-4 w-4" />
              </span>
            </>
          ) : (
            <video
              key={display.url}
              src={display.url}
              controls
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          )
        ) : (
          <PhotoPlaceholder
            seed={placeholderSeed}
            icon={placeholderIcon}
            className="relative h-full w-full"
          />
        )}
        <div className="absolute right-3 top-3">
          <HalalBadge status={halal} />
        </div>
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((item, i) => (
            <button
              key={`${item.type}-${item.url}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
              aria-label={item.type === "video" ? "Voir la vidéo" : `Voir la photo ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-colors ${
                i === activeIndex
                  ? "ring-brand-green"
                  : "ring-transparent hover:ring-brand-green/30"
              }`}
            >
              {item.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <video src={item.url} muted className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && display?.type === "image" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for */}
          <img
            src={display.url}
            alt={name}
            className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
