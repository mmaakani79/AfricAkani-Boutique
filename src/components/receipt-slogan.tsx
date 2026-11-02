import { RECEIPT_SLOGAN } from "@/lib/receipt-slogan";

/** The slogan at the very bottom of a confirmation / receipt page. */
export function ReceiptSlogan({ className = "" }: { className?: string }) {
  return (
    <p
      data-testid="receipt-slogan"
      className={`mt-6 w-full border-t border-brand-gold/40 pt-4 text-center font-brand text-base font-bold text-balance break-words text-brand-green-dark ${className}`.trim()}
    >
      {RECEIPT_SLOGAN}
    </p>
  );
}
