import { ensureSchema, getPool } from "./db";
import { isMaintenanceModeEnabled } from "./maintenance";

// The proxy asks "is the shop closed?" on every request, so the answer is
// cached briefly per server instance. A switch flipped in the admin therefore
// takes effect everywhere within a few seconds.
const CACHE_TTL_MS = 3000;
const READ_TIMEOUT_MS = 1500;

let cache: { closed: boolean; at: number } | null = null;

async function readOverride(): Promise<boolean | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("site_settings read timed out")), READ_TIMEOUT_MS);
  });
  try {
    const { rows } = await Promise.race([
      getPool().query<{ maintenance_mode: boolean | null }>(
        "SELECT maintenance_mode FROM site_settings WHERE id = 1"
      ),
      timeout,
    ]);
    return rows[0]?.maintenance_mode ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/** Used by the proxy on every public request. The admin switch wins; if it was
 *  never used (or the database can't be reached in time) the MAINTENANCE_MODE
 *  environment variable decides, exactly as before. */
export async function isShopClosed(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.closed;

  let closed: boolean;
  try {
    closed = (await readOverride()) ?? isMaintenanceModeEnabled();
  } catch {
    closed = isMaintenanceModeEnabled();
  }
  cache = { closed, at: now };
  return closed;
}

export interface ShopStatus {
  closed: boolean;
  /** true once the admin switch has been used — it then overrides the env variable. */
  overridden: boolean;
  /** What the MAINTENANCE_MODE environment variable alone would say. */
  envClosed: boolean;
}

export async function getShopStatus(): Promise<ShopStatus> {
  await ensureSchema();
  const override = await readOverride();
  const envClosed = isMaintenanceModeEnabled();
  return {
    closed: override ?? envClosed,
    overridden: override !== null,
    envClosed,
  };
}

export async function setShopClosed(closed: boolean): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO site_settings (id, maintenance_mode)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET maintenance_mode = EXCLUDED.maintenance_mode, updated_at = now()`,
    [closed]
  );
  cache = null;
}
