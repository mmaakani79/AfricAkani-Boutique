import type { ShopStatus } from "@/lib/shop-status";

export const SHOP_STATUS_STYLE: Record<ShopStatus, string> = {
  actif: "bg-brand-green text-white",
  en_retard: "bg-amber-500 text-white",
  suspendu: "bg-red-600 text-white",
  supprime: "bg-ink text-ivory",
};
