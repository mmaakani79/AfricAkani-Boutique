import Image from "next/image";
import type { SVGProps } from "react";

// Card network badges: official flat-color SVGs from the `payment-icons`
// package (public/logos/payment/, MPL-2.0 — https://github.com/muffinresearch/payment-icons).
// PayPal is deliberately not in this list — it's its own separate payment
// method with its own button (see PaypalButton below), not a card network
// processed through Stripe, so listing it here as a generic trust badge
// was misleading once real PayPal checkout existed.
const CARD_LOGOS = [
  { src: "/logos/payment/visa.svg", alt: "Visa" },
  { src: "/logos/payment/mastercard.svg", alt: "Mastercard" },
  { src: "/logos/payment/amex.svg", alt: "American Express" },
];

// Mobile Money operator logos, official color, provided by AfricAkani
// (public/logos/*.webp) — same files used in the operator picker at checkout.
const MOBILE_MONEY_LOGOS = [
  { src: "/logos/mtn.webp", alt: "MTN Mobile Money" },
  { src: "/logos/moov.webp", alt: "Moov Money" },
  { src: "/logos/celtiis.webp", alt: "Celtiis" },
];

// Stripe has no card-style badge in that set, so its wordmark is recreated
// here in the brand's official purple. Path sourced from simple-icons
// (https://simpleicons.org, CC0-1.0 — free for any use).
function StripeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <title>Stripe</title>
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

/** Visa / Mastercard / Amex / PayPal / Stripe, in official colors — shown
 *  next to "Payer par carte" at checkout and in the footer. */
export function PaymentBadgeRow({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      {CARD_LOGOS.map((logo) => (
        <Image
          key={logo.alt}
          src={logo.src}
          alt={logo.alt}
          width={750}
          height={471}
          className="h-7 w-auto rounded ring-1 ring-black/10"
        />
      ))}
      <StripeIcon className="h-8 w-8 text-[#635BFF]" />
    </span>
  );
}

/** A full-width, PayPal-branded button (their signature gold pill) — shown
 *  as its own distinct payment option at checkout, separate from the
 *  WhatsApp / Mobile Money / Stripe toggle row so it reads as a genuinely
 *  different way to pay rather than another small pill in that row. */
export function PaypalButton({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-center gap-2 rounded-full border-2 px-5 py-3.5 text-sm font-bold transition-colors ${
        selected
          ? "border-[#ffc439] bg-[#ffc439] text-[#003087] shadow-md"
          : "border-[#ffc439] bg-[#ffc439]/25 text-[#003087] hover:bg-[#ffc439]/50"
      }`}
    >
      <Image
        src="/logos/payment/paypal.svg"
        alt=""
        width={750}
        height={471}
        className="h-6 w-auto"
      />
      Payer avec PayPal
    </button>
  );
}

/** MTN Mobile Money / Moov Money / Celtiis, in official colors, sized to
 *  match {@link PaymentBadgeRow} — shown next to "Mobile Money" at checkout
 *  and in the footer. */
export function MobileMoneyBadgeRow({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      {MOBILE_MONEY_LOGOS.map((logo) => (
        <Image
          key={logo.alt}
          src={logo.src}
          alt={logo.alt}
          width={240}
          height={240}
          className="h-8 w-8 rounded bg-white object-contain p-0.5 ring-1 ring-black/10"
        />
      ))}
    </span>
  );
}
