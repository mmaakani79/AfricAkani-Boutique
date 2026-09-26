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
