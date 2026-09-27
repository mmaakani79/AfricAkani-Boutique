import Image from "next/image";

/** Hero background photo with a dark-green semi-transparent overlay for text contrast. */
export function HeroCollage() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image
        src="/photos/hero-home.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-brand-green-dark/60" />
      {/* Extra darkening behind the left-aligned headline/copy — the flat
       *  overlay alone isn't enough contrast over the photo's bright areas. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent" />
    </div>
  );
}
