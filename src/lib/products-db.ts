import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "./db";
import type {
  HalalStatus,
  PackagingType,
  PriceTier,
  Product,
  ProductVariant,
  StockStatus,
  VariantOption,
  ZoneId,
} from "./types";

interface PriceTierJsonRow {
  zoneId: string;
  minQty: number;
  price: number;
}

interface VariantJsonRow {
  id: string;
  attributes: Record<string, string>;
  sku: string;
  stock: string;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  halal: string;
  unit: string;
  packaging: string;
  description: string;
  long_description: string;
  price_bj: string | null;
  price_ca: string | null;
  price_us: string | null;
  stock: string;
  featured: boolean;
  sku: string | null;
  supplier: string | null;
  image: string | null;
  gallery_images: string[];
  video_url: string | null;
  variant_options: VariantOption[] | null;
  /** Only present when the query joins the price tiers subquery below. */
  price_tiers_json?: PriceTierJsonRow[];
  /** Only present when the query joins the variants subquery below. */
  variants_json?: VariantJsonRow[];
  /** Only present when the query joins the rating/sold aggregates below. */
  avg_rating?: string | null;
  review_count?: string | null;
  sold_count?: string | null;
}

// Extra quantity-pricing steps (minQty > 1), grouped as JSON so a single
// query can carry the one-to-many relation without changing row shape.
const PRICE_TIERS_SELECT = `(
    SELECT COALESCE(json_agg(json_build_object('zoneId', zone_id, 'minQty', min_qty, 'price', unit_price) ORDER BY zone_id, min_qty), '[]'::json)
    FROM product_price_tiers WHERE product_id = p.id
  ) AS price_tiers_json`;

// Sellable variants (Taille/Couleur/… combinations), grouped as JSON for the
// same one-to-many reason as price tiers above.
const VARIANTS_SELECT = `(
    SELECT COALESCE(json_agg(json_build_object('id', id, 'attributes', attributes, 'sku', sku, 'stock', stock) ORDER BY sort_order, id), '[]'::json)
    FROM product_variants WHERE product_id = p.id
  ) AS variants_json`;

// Joined onto "products p" for customer-facing listings (catalogue, home,
// product detail, related products) so ProductCard can show stars/avis/vendus
// without a separate round trip per product.
const RATING_JOIN_SELECT = `p.*, ${PRICE_TIERS_SELECT}, ${VARIANTS_SELECT},
  (SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = p.id AND status = 'approuvee') AS avg_rating,
  (SELECT COUNT(*) FROM product_reviews WHERE product_id = p.id AND status = 'approuvee') AS review_count,
  (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.payment_status = 'paye') AS sold_count`;

function toPriceOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function groupPriceTiers(
  rows: PriceTierJsonRow[] | undefined
): Partial<Record<ZoneId, PriceTier[]>> | undefined {
  if (!rows || rows.length === 0) return undefined;
  const byZone: Partial<Record<ZoneId, PriceTier[]>> = {};
  for (const row of rows) {
    const zoneId = row.zoneId as ZoneId;
    (byZone[zoneId] ??= []).push({ minQty: row.minQty, price: Number(row.price) });
  }
  return byZone;
}

function groupVariants(rows: VariantJsonRow[] | undefined): ProductVariant[] | undefined {
  if (!rows || rows.length === 0) return undefined;
  return rows.map((r) => ({
    id: r.id,
    attributes: r.attributes,
    sku: r.sku,
    stock: r.stock as StockStatus,
  }));
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryId: row.category_id,
    halal: row.halal as HalalStatus,
    unit: row.unit,
    packaging: row.packaging as PackagingType,
    description: row.description,
    longDescription: row.long_description,
    prices: {
      bj: toPriceOrNull(row.price_bj),
      ca: toPriceOrNull(row.price_ca),
      us: toPriceOrNull(row.price_us),
    },
    stock: row.stock as StockStatus,
    featured: row.featured,
    sku: row.sku ?? undefined,
    supplier: row.supplier ?? undefined,
    image: row.image ?? undefined,
    galleryImages: row.gallery_images ?? [],
    videoUrl: row.video_url ?? undefined,
    variantOptions:
      row.variant_options && row.variant_options.length > 0 ? row.variant_options : undefined,
    variants: groupVariants(row.variants_json),
    priceTiers: groupPriceTiers(row.price_tiers_json),
    rating:
      row.avg_rating !== undefined
        ? { average: Number(row.avg_rating ?? 0), count: Number(row.review_count ?? 0) }
        : undefined,
    soldCount: row.sold_count !== undefined ? Number(row.sold_count) : undefined,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `SELECT ${RATING_JOIN_SELECT} FROM products p ORDER BY p.sort_order ASC, p.name ASC`
  );
  return rows.map(rowToProduct);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `SELECT ${RATING_JOIN_SELECT} FROM products p WHERE p.featured = true ORDER BY p.sort_order ASC, p.name ASC`
  );
  return rows.map(rowToProduct);
}

/** Persists the admin's drag-and-drop order — orderedIds must be every
 *  product id, front to back; each gets its index as its new sort_order. */
export async function reorderProducts(orderedIds: string[]): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query("UPDATE products SET sort_order = $2 WHERE id = $1", [
        orderedIds[i],
        i,
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `SELECT ${RATING_JOIN_SELECT} FROM products p WHERE p.slug = $1`,
    [slug]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `SELECT p.*, ${PRICE_TIERS_SELECT}, ${VARIANTS_SELECT} FROM products p WHERE p.id = $1`,
    [id]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

/** For a product's "Vous aimerez aussi" section — same category first, filled out with others. */
export async function getRelatedProducts(
  excludeId: string,
  categoryId: string,
  limit = 4
): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `SELECT ${RATING_JOIN_SELECT} FROM products p
     WHERE p.id != $1
     ORDER BY (p.category_id = $2) DESC, random()
     LIMIT $3`,
    [excludeId, categoryId, limit]
  );
  return rows.map(rowToProduct);
}

export interface ProductInput {
  slug: string;
  name: string;
  categoryId: string;
  halal: HalalStatus;
  unit: string;
  packaging: PackagingType;
  description: string;
  longDescription: string;
  prices: { bj: number | null; ca: number | null; us: number | null };
  stock: StockStatus;
  featured: boolean;
  sku?: string;
  supplier?: string | null;
  /** Omit (undefined) to leave the existing image untouched on update (e.g. a bulk
   *  Excel edit that doesn't manage images); pass "" to explicitly clear it, or a
   *  URL to set it. Always a definite value on create — there's nothing to keep. */
  image?: string;
  /** Extra gallery photos, beyond `image` — always the full replacement list
   *  (the admin form re-sends every URL it wants kept on every save). */
  galleryImages?: string[];
  /** Same clear/set/keep convention as `image`. */
  videoUrl?: string;
  /** Omit (undefined) to leave existing tiers untouched (e.g. Excel bulk edit).
   *  Provided means "this is the full desired state" — a zone absent from it,
   *  or given an empty array, ends up with no extra tiers. */
  priceTiers?: Partial<Record<ZoneId, PriceTier[]>>;
  /** Omit (undefined) to leave the existing option definitions untouched
   *  (e.g. Excel bulk edit). Provided means "this is the full desired state". */
  variantOptions?: VariantOption[];
  /** Omit (undefined) to leave existing variants untouched (e.g. Excel bulk
   *  edit). Provided means "this is the full desired state" — the admin form
   *  always re-sends every variant it wants kept on every save. */
  variants?: ProductVariant[];
}

/** Replaces every extra price tier for a product (minQty > 1 only — the base
 *  price lives on the product row itself, not in this table). */
async function replacePriceTiers(
  client: PoolClient,
  productId: string,
  tiersByZone: Partial<Record<ZoneId, PriceTier[]>>
): Promise<void> {
  await client.query("DELETE FROM product_price_tiers WHERE product_id = $1", [
    productId,
  ]);
  for (const [zoneId, tiers] of Object.entries(tiersByZone)) {
    for (const tier of tiers ?? []) {
      if (tier.minQty <= 1) continue;
      await client.query(
        `INSERT INTO product_price_tiers (product_id, zone_id, min_qty, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [productId, zoneId, tier.minQty, tier.price]
      );
    }
  }
}

/** Replaces every variant for a product — the admin form always re-sends
 *  the full desired list, so this mirrors replacePriceTiers's delete+reinsert. */
async function replaceVariants(
  client: PoolClient,
  productId: string,
  variants: ProductVariant[]
): Promise<void> {
  await client.query("DELETE FROM product_variants WHERE product_id = $1", [productId]);
  for (const [i, variant] of variants.entries()) {
    await client.query(
      `INSERT INTO product_variants (id, product_id, attributes, sku, stock, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        variant.id,
        productId,
        JSON.stringify(variant.attributes),
        variant.sku,
        variant.stock,
        i,
      ]
    );
  }
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await ensureSchema();
  const sku = input.sku?.trim() || `AK-${input.slug.toUpperCase()}`;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ProductRow>(
      `INSERT INTO products
        (id, slug, name, category_id, halal, unit, packaging, description, long_description, price_bj, price_ca, price_us, stock, featured, sku, supplier, image, gallery_images, video_url, variant_options, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM products))
       RETURNING *`,
      [
        input.slug,
        input.slug,
        input.name,
        input.categoryId,
        input.halal,
        input.unit,
        input.packaging,
        input.description,
        input.longDescription,
        input.prices.bj,
        input.prices.ca,
        input.prices.us,
        input.stock,
        input.featured,
        sku,
        input.supplier ?? null,
        input.image?.trim() || null,
        input.galleryImages ?? [],
        input.videoUrl?.trim() || null,
        JSON.stringify(input.variantOptions ?? []),
      ]
    );
    const productId = rows[0].id;
    if (input.priceTiers) {
      await replacePriceTiers(client, productId, input.priceTiers);
    }
    if (input.variants) {
      await replaceVariants(client, productId, input.variants);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  const created = await getProductById(input.slug);
  if (!created) throw new Error("Product creation succeeded but could not be re-read.");
  return created;
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Product | null> {
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ProductRow>(
      `UPDATE products SET
         slug = $2, name = $3, category_id = $4, halal = $5, unit = $6,
         packaging = $7, description = $8, long_description = $9, price_bj = $10,
         price_ca = $11, price_us = $12, stock = $13, featured = $14,
         sku = COALESCE(NULLIF($15, ''), sku),
         supplier = COALESCE($16, supplier),
         image = CASE WHEN $17::text IS NULL THEN image WHEN $17 = '' THEN NULL ELSE $17 END,
         gallery_images = COALESCE($18, gallery_images),
         video_url = CASE WHEN $19::text IS NULL THEN video_url WHEN $19 = '' THEN NULL ELSE $19 END,
         variant_options = CASE WHEN $20::text IS NULL THEN variant_options ELSE $20::jsonb END,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.slug,
        input.name,
        input.categoryId,
        input.halal,
        input.unit,
        input.packaging,
        input.description,
        input.longDescription,
        input.prices.bj,
        input.prices.ca,
        input.prices.us,
        input.stock,
        input.featured,
        input.sku ?? "",
        input.supplier ?? null,
        input.image ?? null,
        input.galleryImages ?? null,
        input.videoUrl ?? null,
        input.variantOptions !== undefined ? JSON.stringify(input.variantOptions) : null,
      ]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    if (input.priceTiers) {
      await replacePriceTiers(client, id, input.priceTiers);
    }
    if (input.variants) {
      await replaceVariants(client, id, input.variants);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getProductById(id);
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "DELETE FROM products WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products WHERE sku = $1",
    [sku]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function getProductByNameCI(name: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products WHERE lower(name) = lower($1) LIMIT 1",
    [name]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
