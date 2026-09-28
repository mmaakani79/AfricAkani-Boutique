"use client";

import { useState } from "react";
import Image from "next/image";

/** Hero background photo with a dark-green semi-transparent overlay for text contrast. */
export function HeroCollage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-brand-green-dark">
      <Image
        src="/photos/hero-home.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        onLoad={() => setLoaded(true)}
        className={`object-cover object-center transition-opacity duration-700 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="absolute inset-0 bg-brand-green-dark/50" />
    </div>
  );
}
