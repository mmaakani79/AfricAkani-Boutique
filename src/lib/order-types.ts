// Pure types/constants for orders — safe to import from client components.
// Never import "./orders-db" (or "./db") from a client component: it pulls
// in the `pg` Node driver, which can't be bundled for the browser.

export type OrderStatus =
  | "nouvelle"
  | "en_preparation"
  | "expediee"
  | "livree"
  | "annulee";

export type PaymentStatus =
  | "en_attente"
  | "en_verification"
  | "paye"
  | "echoue"
  | "rembourse";

export const ORDER_STATUSES: OrderStatus[] = [
  "nouvelle",
  "en_preparation",
  "expediee",
  "livree",
  "annulee",
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "en_attente",
  "en_verification",
  "paye",
  "echoue",
  "rembourse",
];
