import { ensureSchema, getPool } from "./db";
import { slugify } from "./products-db";
import type { Category } from "./types";

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  featured_home: boolean;
  photo_seed: string;
  sort_order: number;
  image: string | null;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    featuredHome: row.featured_home,
    photoSeed: row.photo_seed,
    image: row.image ?? undefined,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  await ensureSchema();
  const { rows } = await getPool().query<CategoryRow>(
    "SELECT * FROM categories ORDER BY sort_order ASC, name ASC"
  );
  return rows.map(rowToCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  await ensureSchema();
  const { rows } = await getPool().query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToCategory(rows[0]) : null;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  await ensureSchema();
  const { rows } = await getPool().query<CategoryRow>(
    "SELECT * FROM categories WHERE slug = $1",
    [slug]
  );
  return rows[0] ? rowToCategory(rows[0]) : null;
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description: string;
  featuredHome: boolean;
  photoSeed: string;
  /** Uploaded cover photo URL, or "" to clear it and fall back to photoSeed. */
  image?: string;
}

/** Thrown by deleteCategory when products still reference it. */
export class CategoryInUseError extends Error {
  constructor(public productCount: number) {
    super(
      `Cette catégorie est utilisée par ${productCount} produit${productCount > 1 ? "s" : ""}.`
    );
    this.name = "CategoryInUseError";
  }
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  await ensureSchema();
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  // New categories go to the end: one past the current highest position (a
  // row count would collide with an existing position after any deletion).
  const { rows } = await getPool().query<CategoryRow>(
    `INSERT INTO categories (id, slug, name, description, featured_home, photo_seed, sort_order, image)
     VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories),$7)
     RETURNING *`,
    [
      slug,
      slug,
      input.name,
      input.description,
      input.featuredHome,
      input.photoSeed,
      input.image?.trim() || null,
    ]
  );
  return rowToCategory(rows[0]);
}

/** Persists the admin's drag-and-drop order. orderedIds is the full list, front
 *  to back; any category missing from it (e.g. created in another tab meanwhile)
 *  keeps its relative place after the listed ones, so positions never collide. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM categories ORDER BY sort_order ASC, name ASC FOR UPDATE"
    );
    const existing = rows.map((r) => r.id);
    const known = new Set(existing);
    const seen = new Set<string>();
    const first = orderedIds.filter((id) => known.has(id) && !seen.has(id) && seen.add(id));
    const final = [...first, ...existing.filter((id) => !seen.has(id))];
    for (let i = 0; i < final.length; i++) {
      await client.query("UPDATE categories SET sort_order = $2 WHERE id = $1", [final[i], i]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<Category | null> {
  await ensureSchema();
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  const { rows } = await getPool().query<CategoryRow>(
    `UPDATE categories SET
       slug = $2, name = $3, description = $4, featured_home = $5, photo_seed = $6, image = $7
     WHERE id = $1
     RETURNING *`,
    [
      id,
      slug,
      input.name,
      input.description,
      input.featuredHome,
      input.photoSeed,
      input.image?.trim() || null,
    ]
  );
  return rows[0] ? rowToCategory(rows[0]) : null;
}

/** Refuses to delete a category still assigned to at least one product —
 *  there's no FK to enforce this, so the check happens here. */
export async function deleteCategory(id: string): Promise<boolean> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM products WHERE category_id = $1",
    [id]
  );
  const productCount = Number(rows[0].count);
  if (productCount > 0) {
    throw new CategoryInUseError(productCount);
  }
  const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/** Product counts per category, for the admin list. */
export async function getProductCountsByCategory(): Promise<Record<string, number>> {
  await ensureSchema();
  const { rows } = await getPool().query<{ category_id: string; count: string }>(
    "SELECT category_id, count(*)::text AS count FROM products GROUP BY category_id"
  );
  return Object.fromEntries(rows.map((r) => [r.category_id, Number(r.count)]));
}
