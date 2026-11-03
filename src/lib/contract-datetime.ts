// How the date and time of a contract signature are SHOWN (PDF, administration). The stored value is
// an instant (UTC) and is never touched: only its display changes. The time zone is always written, so
// "21:44" cannot be mistaken for local time.

const UTC_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "03 novembre 2026 à 21:44 UTC" — the same text whatever the time zone of the server or of the browser. */
export function formatSignedAtUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return `${UTC_FORMAT.format(date)} UTC`;
}
