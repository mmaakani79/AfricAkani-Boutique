// Pure helper (no imports, no I/O) building the line logged when an admin
// login is refused on a Vercel PREVIEW deployment — temporary, to find out why
// the test password is rejected. It only ever reports lengths and yes/no
// facts: never the password, nor any part of it (no first/last character, no
// hash, no comparison result between the two values).

type Env = Record<string, string | undefined>;

export type LoginRefusal = "mot-de-passe-incorrect" | "erreur-interne";

export interface LoginDiagnostic {
  evenement: "connexion-admin-refusee";
  resultat: LoginRefusal;
  vercel_env: string;
  saisie_longueur: number;
  admin_password_definie: boolean;
  admin_password_longueur: number | null;
  longueurs_egales: boolean | null;
  admin_password_commence_par_espace_ou_retour: boolean | null;
  admin_password_finit_par_espace_ou_retour: boolean | null;
  /** true: a stored (hashed) password is used and ADMIN_PASSWORD is ignored. */
  utilise_mot_de_passe_chiffre: boolean | "inconnu";
  /** Only for "erreur-interne": a fixed category, never the raw message. */
  cause?: "admin-password-absente" | "garde-fou-base" | "autre";
}

const LEADING = /^[ \t\r\n]/;
const TRAILING = /[ \t\r\n]$/;

/** The diagnostic runs on Preview deployments only — never in production. */
export function isPreviewDiagnosticEnabled(env: Env): boolean {
  return env.VERCEL_ENV === "preview";
}

export function classifyLoginError(err: unknown): NonNullable<LoginDiagnostic["cause"]> {
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("ADMIN_PASSWORD is not set")) return "admin-password-absente";
  if (message.startsWith("Prévisualisation :")) return "garde-fou-base";
  return "autre";
}

export function buildLoginDiagnostic(input: {
  env: Env;
  candidate: string;
  resultat: LoginRefusal;
  usesStoredHash: boolean | "inconnu";
  cause?: LoginDiagnostic["cause"];
}): LoginDiagnostic {
  const { env, candidate } = input;
  const expected = env.ADMIN_PASSWORD;
  const defined = typeof expected === "string" && expected.length > 0;
  return {
    evenement: "connexion-admin-refusee",
    resultat: input.resultat,
    vercel_env: env.VERCEL_ENV ?? "(non défini)",
    saisie_longueur: candidate.length,
    admin_password_definie: defined,
    admin_password_longueur: defined ? expected.length : null,
    longueurs_egales: defined ? expected.length === candidate.length : null,
    admin_password_commence_par_espace_ou_retour: defined ? LEADING.test(expected) : null,
    admin_password_finit_par_espace_ou_retour: defined ? TRAILING.test(expected) : null,
    utilise_mot_de_passe_chiffre: input.usesStoredHash,
    ...(input.cause ? { cause: input.cause } : {}),
  };
}
