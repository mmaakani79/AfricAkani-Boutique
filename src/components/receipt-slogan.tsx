import type { ReactNode } from "react";
import { RECEIPT_SLOGAN } from "@/lib/receipt-slogan";

/**
 * The bottom of a confirmation / receipt page: the concluding block (`children`: provider line,
 * refund terms…) centered, then the slogan. The detail of the page above stays as it is.
 */
export function ReceiptSlogan({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div data-testid="receipt-ending" className={`mt-6 w-full text-center ${className}`.trim()}>
      {children ? <div className="mb-4 space-y-1 text-xs text-ink/50 [overflow-wrap:anywhere]">{children}</div> : null}
      <p
        data-testid="receipt-slogan"
        className="w-full border-t border-brand-gold/40 pt-4 text-center font-brand text-base font-bold text-balance break-words text-brand-green-dark"
      >
        {RECEIPT_SLOGAN}
      </p>
    </div>
  );
}
