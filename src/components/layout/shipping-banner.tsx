"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useZone } from "@/context/zone-context";
import { NEUTRAL_MESSAGE, bannerItems, type BannerItem } from "@/lib/shipping-banner";
import { Container } from "./container";

// The scrolling text moves at a steady, slow pace whatever the screen width.
const SCROLL_PX_PER_SECOND = 42;
const FALLBACK_SECONDS = 40;

function BannerText({ items }: { items: BannerItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        <span key={item.zoneId} className="ship-item">
          {index > 0 && (
            <span className="ship-sep" aria-hidden>
              •
            </span>
          )}
          {item.primary ? (
            <>
              Livraison offerte dès <strong className="ship-amount">{item.amount}</strong>{" "}
              d&rsquo;achat <span className="ship-zone">— {item.label}</span>
            </>
          ) : (
            <>
              {item.label} : dès <strong className="ship-amount-other">{item.amount}</strong>
            </>
          )}
          {/* Read aloud as separate sentences; invisible on screen. */}
          <span className="sr-only">. </span>
        </span>
      ))}
    </>
  );
}

/** A small delivery truck, facing left (the way the text travels), with turning
 *  wheels, a very slight bounce and speed lines behind it. Plain SVG + CSS. */
function Truck() {
  return (
    <svg
      className="ship-truck"
      viewBox="0 0 60 24"
      aria-hidden
      focusable="false"
    >
      <g className="ship-truck-body">
        <rect x="15" y="3" width="29" height="14" rx="1.6" fill="#FFD700" />
        <path d="M15 7H8.4L2.6 12.3V17H15Z" fill="#F2BD0C" />
        <path d="M13.2 8.7H9.2L5.6 12H13.2Z" fill="#0a4534" />
        <rect x="2.6" y="16" width="41.4" height="1.4" fill="#B88A00" />
      </g>
      <g transform="translate(9.6 18.6)">
        <g className="ship-wheel">
          <circle r="3.3" fill="#F4F1E9" stroke="#0a4534" strokeWidth="1" />
          <path d="M-2.1 0H2.1M0 -2.1V2.1" stroke="#0a4534" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(35.4 18.6)">
        <g className="ship-wheel">
          <circle r="3.3" fill="#F4F1E9" stroke="#0a4534" strokeWidth="1" />
          <path d="M-2.1 0H2.1M0 -2.1V2.1" stroke="#0a4534" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      <g stroke="#F4F1E9" strokeWidth="1.5" strokeLinecap="round">
        <line className="ship-speed ship-speed-1" x1="46" y1="6.5" x2="58" y2="6.5" />
        <line className="ship-speed ship-speed-2" x1="46" y1="11" x2="55" y2="11" />
        <line className="ship-speed ship-speed-3" x1="46" y1="15.5" x2="57" y2="15.5" />
      </g>
    </svg>
  );
}

export function ShippingBanner() {
  const { zoneId, liveShipping } = useZone();
  const items = bannerItems(zoneId, liveShipping);
  const scrolling = items.length > 0;

  // "auto": paused while the mouse is over the banner or the keyboard is on it.
  // The button overrides that: "paused" stops it, "playing" keeps it running.
  const [mode, setMode] = useState<"auto" | "paused" | "playing">("auto");
  const paused = mode === "paused";
  const [duration, setDuration] = useState(FALLBACK_SECONDS);
  const copyRef = useRef<HTMLDivElement>(null);

  // One loop = one copy of the text: its width sets the duration, so the speed
  // is the same on a phone and on a wide screen.
  useEffect(() => {
    const el = copyRef.current;
    if (!el || !scrolling) return;
    const measure = () => {
      const width = el.offsetWidth;
      if (width > 0) setDuration(Math.max(12, Math.round(width / SCROLL_PX_PER_SECOND)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrolling, items.length, zoneId]);

  return (
    <section
      aria-label="Livraison offerte"
      data-testid="shipping-banner"
      data-mode={mode}
      className="ship-banner bg-brand-green-dark text-white"
    >
      <Container className="flex min-h-9 items-center gap-1 py-1 text-xs font-semibold sm:gap-2 sm:text-sm">
        <div className="ship-truck-wrap">
          <Truck />
        </div>

        {scrolling ? (
          <div className="ship-viewport" data-testid="shipping-banner-text">
            <div className="ship-track" style={{ ["--ship-duration" as string]: `${duration}s` }}>
              <div className="ship-copy" ref={copyRef}>
                <BannerText items={items} />
              </div>
              <div className="ship-copy" aria-hidden>
                <BannerText items={items} />
              </div>
            </div>
          </div>
        ) : (
          <p className="ship-static" data-testid="shipping-banner-text">
            {NEUTRAL_MESSAGE}
          </p>
        )}

        {scrolling && (
          <button
            type="button"
            className="ship-pause"
            aria-pressed={paused}
            aria-label={
              paused ? "Reprendre le défilement du bandeau" : "Mettre en pause le défilement du bandeau"
            }
            onClick={() => setMode((m) => (m === "paused" ? "playing" : "paused"))}
          >
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
          </button>
        )}
      </Container>
    </section>
  );
}
