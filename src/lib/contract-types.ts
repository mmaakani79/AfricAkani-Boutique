// Pure types/constants for signed contracts — safe to import from client
// components. Never import "./contracts-db" (or "./db") from a client
// component: it pulls in the `pg` Node driver, which can't be bundled for
// the browser.

export const CONTRACT_SERVICES = [
  "Boutique en ligne",
  "Site web",
  "Application de gestion",
  "Matériel et achats",
  "Réseau et cybersécurité",
  "Autre",
] as const;

export type ContractService = (typeof CONTRACT_SERVICES)[number];

/** Contract references look like "CT-MGX4F2K9-7QHD": created by the form, used in URLs and file names. */
export const CONTRACT_ID_PATTERN = /^CT-[A-Z0-9]{4,30}(-[A-Z0-9]{2,12})?$/;

export function isValidContractId(id: unknown): id is string {
  return typeof id === "string" && CONTRACT_ID_PATTERN.test(id);
}
