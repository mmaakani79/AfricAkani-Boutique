"use client";

import { AlertTriangle } from "lucide-react";
import type { PriceChangeLine, PriceChangeReport } from "@/lib/price-change";

/** Shown instead of paying when a price differs from what the customer was
 *  looking at. Nothing has been created or charged at this point. */
export function PriceChangePanel({
  report,
  format,
  busy,
  onContinue,
  onRemove,
}: {
  report: PriceChangeReport;
  format: (amount: number) => string;
  busy: boolean;
  onContinue: () => void;
  onRemove: (line: PriceChangeLine) => void;
}) {
  const shipping = (fee: number) => (fee > 0 ? format(fee) : "Gratuite");
  const shippingChanged =
    report.newShippingFee !== null && report.newShippingFee !== report.oldShippingFee;
  const threshold = report.shipping.freeShippingThreshold;

  return (
    <div
      role="alert"
      data-testid="price-change-panel"
      className="space-y-3 rounded-2xl border-2 border-brand-gold bg-brand-gold/10 p-4 text-sm text-ink"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
        <div>
          <p className="font-bold text-brand-green-dark">
            {report.hasUnavailable
              ? "Votre panier doit être mis à jour"
              : "Certains prix ont changé"}
          </p>
          <p className="text-xs text-ink/70">
            Aucune commande n&rsquo;a été créée et rien n&rsquo;a été payé. Voici ce qui a
            changé depuis l&rsquo;ajout au panier :
          </p>
        </div>
      </div>

      {report.lines.length > 0 && (
        <ul className="space-y-2">
          {report.lines.map((line) => (
            <li
              key={`${line.productId}::${line.variantId ?? ""}`}
              data-testid="price-change-line"
              className="space-y-1.5 rounded-xl bg-white p-3"
            >
              <p className="font-semibold">
                {line.quantity} × {line.name}
              </p>
              {line.kind === "price" ? (
                <p className="text-xs">
                  Ancien prix :{" "}
                  <span className="font-semibold line-through">
                    {line.oldUnitPrice === null ? "non vendu" : format(line.oldUnitPrice)}
                  </span>{" "}
                  → nouveau prix :{" "}
                  <span
                    className={`font-bold ${
                      line.oldUnitPrice !== null && line.newUnitPrice! < line.oldUnitPrice
                        ? "text-brand-green"
                        : "text-red-600"
                    }`}
                  >
                    {format(line.newUnitPrice!)}
                  </span>{" "}
                  l&rsquo;unité
                </p>
              ) : (
                <p className="text-xs font-semibold text-red-600">{line.reason}</p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(line)}
                className="rounded-full border border-brand-green/30 px-3 py-1 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-50"
              >
                Retirer ce produit
              </button>
            </li>
          ))}
        </ul>
      )}

      {shippingChanged && (
        <p className="text-xs" data-testid="price-change-shipping">
          Livraison : <span className="line-through">{shipping(report.oldShippingFee)}</span> →{" "}
          <span className="font-bold">{shipping(report.newShippingFee!)}</span>.{" "}
          {report.newShippingFee === 0
            ? `Votre commande atteint le seuil de livraison offerte (${format(threshold)}).`
            : report.oldShippingFee === 0
              ? `Votre commande n'atteint plus le seuil de livraison offerte (${format(threshold)}).`
              : null}
        </p>
      )}

      <div className="space-y-0.5 border-t border-brand-gold/40 pt-2">
        <p className="text-xs text-ink/70">
          Ancien total : <span className="font-semibold">{format(report.oldTotal)}</span>
        </p>
        {report.newTotal !== null && (
          <p className="text-base font-bold text-brand-green-dark" data-testid="price-change-new-total">
            Nouveau total : {format(report.newTotal)}
          </p>
        )}
      </div>

      {report.hasUnavailable && (
        <p className="text-xs font-semibold text-ink/70">
          Retirez d&rsquo;abord les produits indisponibles pour continuer.
        </p>
      )}
      <button
        type="button"
        disabled={busy || report.hasUnavailable}
        onClick={onContinue}
        className="w-full rounded-full bg-brand-green py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continuer au nouveau prix
      </button>
    </div>
  );
}
