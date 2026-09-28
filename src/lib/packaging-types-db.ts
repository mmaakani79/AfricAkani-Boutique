import { ensureSchema, getPool } from "./db";
import { slugify } from "./products-db";
import type { PackagingTypeRecord } from "./types";

interface PackagingTypeRow {
  id: string;
  name: string;
  sort_order: number;
}

function rowToPackagingType(row: PackagingTypeRow): PackagingTypeRecord {
  return { id: row.id, name: row.name };
}

export async function getAllPackagingTypes(): Promise<PackagingTypeRecord[]> {
  await ensureSchema();
  const { rows } = await getPool().query<PackagingTypeRow>(
    "SELECT * FROM packaging_types ORDER BY sort_order ASC, name ASC"
  );
  return rows.map(rowToPackagingType);
}

export async function getPackagingTypeById(
  id: string
): Promise<PackagingTypeRecord | null> {
  await ensureSchema();
  const { rows } = await getPool().query<PackagingTypeRow>(
    "SELECT * FROM packaging_types WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToPackagingType(rows[0]) : null;
}

export interface PackagingTypeInput {
  name: string;
}

/** Thrown by deletePackagingType when products still reference it. */
export class PackagingTypeInUseError extends Error {
  constructor(public productCount: number) {
    super(
      `Ce type d'emballage est utilisé par ${productCount} produit${productCount > 1 ? "s" : ""}.`
    );
    this.name = "PackagingTypeInUseError";
  }
}

export async function createPackagingType(
  input: PackagingTypeInput
): Promise<PackagingTypeRecord> {
  await ensureSchema();
  const id = slugify(input.name);
  const pool = getPool();
  const { rows: countRows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM packaging_types"
  );
  const { rows } = await pool.query<PackagingTypeRow>(
    `INSERT INTO packaging_types (id, name, sort_order)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [id, input.name, Number(countRows[0].count)]
  );
  return rowToPackagingType(rows[0]);
}

export async function updatePackagingType(
  id: string,
  input: PackagingTypeInput
): Promise<PackagingTypeRecord | null> {
  await ensureSchema();
  const { rows } = await getPool().query<PackagingTypeRow>(
    `UPDATE packaging_types SET name = $2 WHERE id = $1 RETURNING *`,
    [id, input.name]
  );
  return rows[0] ? rowToPackagingType(rows[0]) : null;
}

/** Refuses to delete a packaging type still assigned to at least one
 *  product — there's no FK to enforce this, so the check happens here. */
export async function deletePackagingType(id: string): Promise<boolean> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM products WHERE packaging = $1",
    [id]
  );
  const productCount = Number(rows[0].count);
  if (productCount > 0) {
    throw new PackagingTypeInUseError(productCount);
  }
  const { rowCount } = await pool.query(
    "DELETE FROM packaging_types WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}

/** Product counts per packaging type, for the admin list. */
export async function getProductCountsByPackagingType(): Promise<
  Record<string, number>
> {
  await ensureSchema();
  const { rows } = await getPool().query<{ packaging: string; count: string }>(
    "SELECT packaging, count(*)::text AS count FROM products GROUP BY packaging"
  );
  return Object.fromEntries(rows.map((r) => [r.packaging, Number(r.count)]));
}
