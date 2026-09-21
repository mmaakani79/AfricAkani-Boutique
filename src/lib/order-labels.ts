import type { OrderStatus, PaymentStatus } from "./order-types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nouvelle: "Nouvelle",
  en_preparation: "En préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  nouvelle: "bg-brand-gold/15 text-brand-gold",
  en_preparation: "bg-blue-100 text-blue-700",
  expediee: "bg-purple-100 text-purple-700",
  livree: "bg-brand-green/15 text-brand-green-dark",
  annulee: "bg-red-100 text-red-700",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: "En attente",
  paye: "Payé",
  echoue: "Échoué",
  rembourse: "Remboursé",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  en_attente: "bg-brand-gold/15 text-brand-gold",
  paye: "bg-brand-green/15 text-brand-green-dark",
  echoue: "bg-red-100 text-red-700",
  rembourse: "bg-ink/10 text-ink/70",
};
