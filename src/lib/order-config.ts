// NEXT_PUBLIC_-prefixed so the same value can be shown on the /commande
// page (client component) and used server-side by the cron job — the
// prefix only widens visibility, it doesn't restrict server access.
export function getPaymentTimeoutHours(): number {
  const raw = Number(process.env.NEXT_PUBLIC_ORDER_PAYMENT_TIMEOUT_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 72;
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.africakani.com").replace(
    /\/+$/,
    ""
  );
}

export function getAdminNotifyEmail(): string {
  return (
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.NOTIFY_EMAIL ||
    "contact@africakani.com"
  );
}
