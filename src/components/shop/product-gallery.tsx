"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { HalalStatus } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "./photo-placeholder";
import { HalalBadge } from "./halal-badge";

type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

/** Product page media viewer — cover photo, extra gallery photos, and an
 *  optional video, with click-to-select thumbnails. The video plays inline
 *  (native <video controls>), never navigating away from the page. */
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
  const active = media[activeIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink/5">
        {active ? (
          active.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for
            <img src={active.url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <video
              key={active.url}
              src={active.url}
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
    </div>
  );
}
