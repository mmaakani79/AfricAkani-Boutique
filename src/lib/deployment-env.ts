// Pure helpers (no imports, no I/O) deciding which database a deployment may
// talk to. Kept separate from db.ts so they can be unit-tested without `pg`.

export type DeploymentEnv = "production" | "preview" | "local";

type Env = Record<string, string | undefined>;

/** Vercel sets VERCEL_ENV on every deployment. Anything else (local dev,
 *  `vercel dev`, tests) is "local". */
export function getDeploymentEnv(env: Env = process.env): DeploymentEnv {
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.VERCEL_ENV === "production") return "production";
  return "local";
}

/** Lower-cased host, without trailing dot, and without Neon's "-pooler"
 *  suffix, so the pooled and direct addresses of one database compare equal. */
function normalizeHost(host: string): string {
  const lower = host.trim().toLowerCase().replace(/\.$/, "");
  const [first, ...rest] = lower.split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

function hostOfUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host ? normalizeHost(host) : null;
  } catch {
    return null;
  }
}

const PRODUCTION_URL_VARS = [
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
] as const;

const PRODUCTION_HOST_VARS = ["POSTGRES_HOST", "PGHOST", "PGHOST_UNPOOLED"] as const;

/** The connection string this deployment is allowed to use.
 *
 *  - Vercel Preview: ONLY PREVIEW_DATABASE_URL. Never falls back to the
 *    production variables (which Vercel also exposes to Preview), and refuses
 *    one that points at the same host as any of them.
 *  - Everywhere else (production, local): unchanged — POSTGRES_URL, then
 *    POSTGRES_URL_NON_POOLING, then DATABASE_URL. */
export function resolveDatabaseUrl(env: Env): string {
  if (getDeploymentEnv(env) === "preview") {
    const url = env.PREVIEW_DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "Prévisualisation : PREVIEW_DATABASE_URL n'est pas définie. Connexion à la base refusée (jamais de repli sur la base de production)."
      );
    }

    const previewHost = hostOfUrl(url);
    if (!previewHost) {
      throw new Error(
        "Prévisualisation : PREVIEW_DATABASE_URL est illisible (adresse de base introuvable). Connexion refusée."
      );
    }

    for (const name of PRODUCTION_URL_VARS) {
      const value = env[name]?.trim();
      if (!value) continue;
      if (value === url || hostOfUrl(value) === previewHost) {
        throw new Error(
          `Prévisualisation : PREVIEW_DATABASE_URL pointe vers le même serveur que ${name} (la base de production). Connexion refusée.`
        );
      }
    }
    for (const name of PRODUCTION_HOST_VARS) {
      const value = env[name]?.trim();
      if (value && normalizeHost(value) === previewHost) {
        throw new Error(
          `Prévisualisation : PREVIEW_DATABASE_URL pointe vers le même serveur que ${name} (la base de production). Connexion refusée.`
        );
      }
    }
    return url;
  }

  const url = env.POSTGRES_URL || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Set POSTGRES_URL (Vercel Postgres injects this automatically once the Storage integration is added)."
    );
  }
  return url;
}
