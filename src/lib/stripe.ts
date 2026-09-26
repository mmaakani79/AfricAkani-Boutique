import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type StripeKeyMode = "live" | "test" | "non_configuree";

/** A test card (e.g. 4242 4242 4242 4242) is always declined against a
 *  `sk_live_...` key — that's Stripe's own behaviour, not a bug here. This
 *  reads the key's prefix (never the key itself) so the admin can check
 *  which mode is actually deployed without needing the Vercel dashboard. */
export function getStripeKeyMode(): StripeKeyMode {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return "non_configuree";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "test";
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(key);
}
