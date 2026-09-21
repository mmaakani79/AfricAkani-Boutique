import type { OrderStatus, PaymentStatus } from "./order-types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nouvelle: "Nouvelle",
  en_preparation: "En préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

// Solid, high-contrast fills — legible at a glance, not pale tints.
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  nouvelle: "bg-blue-600 text-white",
  en_preparation: "bg-indigo-600 text-white",
  expediee: "bg-purple-600 text-white",
  livree: "bg-brand-green text-white",
  annulee: "bg-red-600 text-white",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: "En attente",
  en_verification: "En vérification",
  paye: "Payé",
  echoue: "Échoué",
  rembourse: "Remboursé",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  en_attente: "bg-orange-500 text-white",
  en_verification: "bg-amber-600 text-white",
  paye: "bg-brand-green text-white",
  echoue: "bg-red-600 text-white",
  rembourse: "bg-ink text-ivory",
};
