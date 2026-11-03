import { randomBytes } from "node:crypto";
import { ensureSchema, getPool } from "./db";
import { randomServiceId } from "./service-token";
import { todayInBenin } from "./service-account-math";
import {
  deleteAfterDate,
  transitionError,
  type ShopStatus,
} from "./shop-status";

// Client shops and their status (the "switch"). Rows are never deleted; every change of status is
// written to an append-only journal (see the guards in db.ts).

export interface ClientShop {
  id: string;
  createdAt: string;
  name: string;
  domain: string;
  accountId: string | null;
  /** Identifier used in the shop's status address. Not a secret: the answers are signed. */
  publicKey: string;
  status: ShopStatus;
  statusReason: string;
  statusChangedAt: string;
  suspendedAt: string | null;
  /** YYYY-MM-DD: the data is kept until then; only after can the shop be marked deleted. */
  deleteAfter: string | null;
  note: string;
}

export interface ClientShopEvent {
  id: number;
  createdAt: string;
  kind: string;
  fromStatus: ShopStatus | null;
  toStatus: ShopStatus | null;
  reason: string;
}

const COLUMNS = `id, created_at, name, domain, account_id, public_key, status, status_reason, status_changed_at,
  suspended_at, to_char(delete_after, 'YYYY-MM-DD') AS delete_after, note`;

interface Row {
  id: string;
  created_at: Date;
  name: string;
  domain: string;
  account_id: string | null;
  public_key: string;
  status: string;
  status_reason: string;
  status_changed_at: Date;
  suspended_at: Date | null;
  delete_after: string | null;
  note: string;
}

function rowToShop(r: Row): ClientShop {
  return {
    id: r.id,
    createdAt: r.created_at.toISOString(),
    name: r.name,
    domain: r.domain,
    accountId: r.account_id,
    publicKey: r.public_key,
    status: r.status as ShopStatus,
    statusReason: r.status_reason,
    statusChangedAt: r.status_changed_at.toISOString(),
    suspendedAt: r.suspended_at ? r.suspended_at.toISOString() : null,
    deleteAfter: r.delete_after,
    note: r.note,
  };
}

export async function listClientShops(): Promise<ClientShop[]> {
  await ensureSchema();
  const { rows } = await getPool().query<Row>(`SELECT ${COLUMNS} FROM client_shops ORDER BY created_at DESC`);
  return rows.map(rowToShop);
}

export async function getClientShop(id: string): Promise<ClientShop | null> {
  await ensureSchema();
  const { rows } = await getPool().query<Row>(`SELECT ${COLUMNS} FROM client_shops WHERE id = $1`, [id]);
  return rows[0] ? rowToShop(rows[0]) : null;
}

export async function getClientShopByPublicKey(publicKey: string): Promise<ClientShop | null> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(publicKey)) return null;
  await ensureSchema();
  const { rows } = await getPool().query<Row>(`SELECT ${COLUMNS} FROM client_shops WHERE public_key = $1`, [publicKey]);
  return rows[0] ? rowToShop(rows[0]) : null;
}

export async function getClientShopEvents(shopId: string): Promise<ClientShopEvent[]> {
  await ensureSchema();
  const { rows } = await getPool().query<{
    id: string;
    created_at: Date;
    kind: string;
    from_status: string | null;
    to_status: string | null;
    reason: string;
  }>(
    "SELECT id, created_at, kind, from_status, to_status, reason FROM client_shop_events WHERE shop_id = $1 ORDER BY id DESC",
    [shopId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    createdAt: r.created_at.toISOString(),
    kind: r.kind,
    fromStatus: r.from_status as ShopStatus | null,
    toStatus: r.to_status as ShopStatus | null,
    reason: r.reason,
  }));
}

export async function createClientShop(input: {
  name: string;
  domain: string;
  accountId: string | null;
  note: string;
}): Promise<ClientShop> {
  await ensureSchema();
  const id = randomServiceId("BQ");
  const publicKey = randomBytes(16).toString("base64url"); // 22 characters
  const pool = getPool();
  const { rows } = await pool.query<Row>(
    `INSERT INTO client_shops (id, name, domain, account_id, public_key, note)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [id, input.name, input.domain, input.accountId, publicKey, input.note]
  );
  await pool.query(
    "INSERT INTO client_shop_events (shop_id, kind, to_status, reason) VALUES ($1, 'boutique_creee', 'actif', $2)",
    [id, "Boutique ajoutée à la liste."]
  );
  return rowToShop(rows[0]);
}

export type ChangeStatusResult = { ok: true; shop: ClientShop } | { ok: false; error: string };

/** Changes a shop's status by hand, after checking the rules; the change and its reason go to the journal. */
export async function changeClientShopStatus(
  id: string,
  to: ShopStatus,
  reason: string
): Promise<ChangeStatusResult> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<Row>(`SELECT ${COLUMNS} FROM client_shops WHERE id = $1 FOR UPDATE`, [id]);
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Boutique introuvable." };
    }
    const shop = rowToShop(current.rows[0]);
    const today = todayInBenin();
    const error = transitionError(shop.status, to, { reason, deleteAfter: shop.deleteAfter, today });
    if (error) {
      await client.query("ROLLBACK");
      return { ok: false, error };
    }
    const cleanReason = reason.trim().slice(0, 300);
    const suspending = to === "suspendu";
    const { rows } = await client.query<Row>(
      `UPDATE client_shops
          SET status = $2, status_reason = $3, status_changed_at = now(),
              suspended_at = CASE WHEN $4::boolean THEN now() WHEN $2 = 'actif' THEN NULL ELSE suspended_at END,
              delete_after = CASE WHEN $4::boolean THEN $5::date WHEN $2 = 'actif' THEN NULL ELSE delete_after END
        WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, to, cleanReason, suspending, deleteAfterDate(today)]
    );
    const kind =
      to === "suspendu" ? "suspension" : to === "actif" ? (shop.status === "suspendu" ? "reactivation" : "retour_actif") : to === "supprime" ? "suppression" : "marquee_en_retard";
    await client.query(
      "INSERT INTO client_shop_events (shop_id, kind, from_status, to_status, reason) VALUES ($1, $2, $3, $4, $5)",
      [id, kind, shop.status, to, cleanReason]
    );
    await client.query("COMMIT");
    return { ok: true, shop: rowToShop(rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
