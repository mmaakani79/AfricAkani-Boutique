// Which delivery countries each sales zone accepts, and the check applied to an
// order's address. Pure (no DB, no React): shared by the checkout form (the
// country list) and the server (the actual refusal), and unit-tested.
//
// The browser's choice is never trusted: the server runs `checkAddressCountry`
// on every order, whatever the payment method (WhatsApp, Mobile Money, Stripe,
// PayPal), before anything is created or charged.

import { ZONES } from "@/data/zones";
import type { ZoneId } from "./types";

interface Country {
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  /** The name shown to customers and stored on the order. */
  name: string;
  /** Other spellings accepted on input (accents, case and punctuation are ignored). */
  aliases: string[];
}

const COUNTRIES: Country[] = [
  { code: "BJ", name: "Bénin", aliases: ["Benin", "République du Bénin", "Republic of Benin", "BJ"] },
  { code: "CA", name: "Canada", aliases: ["CA"] },
  {
    code: "US",
    name: "États-Unis",
    aliases: [
      "Etats-Unis",
      "Etats Unis",
      "États-Unis d'Amérique",
      "Etats-Unis d'Amerique",
      "USA",
      "U.S.A.",
      "US",
      "U.S.",
      "United States",
      "United States of America",
    ],
  },
];

/** The countries each zone delivers to (ISO codes). THE table to validate: a
 *  country not listed under a zone is refused for that zone.
 *
 *  - bj: Benin only (the zone is priced in FCFA, but delivery is Benin only).
 *  - ca: Canada only.  us: United States only. */
export const ZONE_COUNTRY_CODES: Record<ZoneId, readonly string[]> = {
  bj: ["BJ"],
  ca: ["CA"],
  us: ["US"],
};

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Lower-case, no accents, punctuation → single spaces: "Côte d’Ivoire" ≡ "cote d ivoire". */
function normalizeCountryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CODE_BY_TEXT = new Map<string, string>();
for (const country of COUNTRIES) {
  for (const text of [country.name, ...country.aliases]) {
    CODE_BY_TEXT.set(normalizeCountryText(text), country.code);
  }
}

/** The ISO code of a country typed by a customer, or null if it is not one we know.
 *  Exact match only: "Nigeria" is not "Niger". */
export function countryCodeFromText(value: string): string | null {
  return CODE_BY_TEXT.get(normalizeCountryText(value)) ?? null;
}

export function countryName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

/** The countries the checkout form offers for a zone, in display order. */
export function countriesForZone(zoneId: ZoneId): { code: string; name: string }[] {
  return ZONE_COUNTRY_CODES[zoneId].map((code) => ({ code, name: countryName(code) }));
}

/** The zone that delivers to this country, if any. */
export function zoneForCountryCode(code: string): ZoneId | null {
  for (const zoneId of Object.keys(ZONE_COUNTRY_CODES) as ZoneId[]) {
    if (ZONE_COUNTRY_CODES[zoneId].includes(code)) return zoneId;
  }
  return null;
}

function listNames(zoneId: ZoneId): string {
  const names = countriesForZone(zoneId).map((c) => c.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
}

export type AddressCheck =
  | { ok: true; country: string }
  | { ok: false; error: string };

/** Does this delivery country belong to the zone the customer chose? On success,
 *  returns the country's canonical name (what gets stored on the order). */
export function checkAddressCountry(zoneId: ZoneId, rawCountry: string | null | undefined): AddressCheck {
  const typed = (rawCountry ?? "").trim();
  if (!typed) {
    return { ok: false, error: "Merci d'indiquer le pays de livraison." };
  }

  const code = countryCodeFromText(typed);
  if (!code) {
    return {
      ok: false,
      error:
        `Nous ne livrons pas encore en « ${typed} ». Pays desservis : ` +
        `${listNames("bj")} ; ${listNames("ca")} ; ${listNames("us")}.`,
    };
  }

  if (ZONE_COUNTRY_CODES[zoneId].includes(code)) {
    return { ok: true, country: countryName(code) };
  }

  const name = countryName(code);
  const rightZone = zoneForCountryCode(code);
  const chosen = ZONES[zoneId].label;
  return {
    ok: false,
    error:
      `L'adresse indiquée est en ${name}, mais la zone de livraison choisie est « ${chosen} » ` +
      `(pays desservis : ${listNames(zoneId)}). ` +
      (rightZone
        ? `Pour livrer en ${name}, choisissez la zone « ${ZONES[rightZone].label} ».`
        : `Nous ne livrons pas encore en ${name}.`),
  };
}
