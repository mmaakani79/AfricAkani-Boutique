import { ensureSchema, getPool } from "./db";
import type { HalalStatus, PackagingType, Product, StockStatus } from "./types";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  halal: string;
  unit: string;
  packaging: string;
  description: string;
  price_bj: string | null;
  price_ca: string | null;
  price_us: string | null;
  stock: string;
  featured: boolean;
  sku: string | null;
  supplier: string | null;
  image: string | null;
}

function toPriceOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
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
  };
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products ORDER BY name ASC"
  );
  return rows.map(rowToProduct);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products WHERE featured = true ORDER BY name ASC"
  );
  return rows.map(rowToProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products WHERE slug = $1",
    [slug]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    "SELECT * FROM products WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export interface ProductInput {
  slug: string;
  name: string;
  categoryId: string;
  halal: HalalStatus;
  unit: string;
  packaging: PackagingType;
  description: string;
  prices: { bj: number | null; ca: number | null; us: number | null };
  stock: StockStatus;
  featured: boolean;
  sku?: string;
  supplier?: string | null;
  image?: string | null;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await ensureSchema();
  const sku = input.sku?.trim() || `AK-${input.slug.toUpperCase()}`;
  const { rows } = await getPool().query<ProductRow>(
    `INSERT INTO products
      (id, slug, name, category_id, halal, unit, packaging, description, price_bj, price_ca, price_us, stock, featured, sku, supplier, image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
      input.prices.bj,
      input.prices.ca,
      input.prices.us,
      input.stock,
      input.featured,
      sku,
      input.supplier ?? null,
      input.image ?? null,
    ]
  );
  return rowToProduct(rows[0]);
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Product | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `UPDATE products SET
       slug = $2, name = $3, category_id = $4, halal = $5, unit = $6,
       packaging = $7, description = $8, price_bj = $9, price_ca = $10,
       price_us = $11, stock = $12, featured = $13,
       sku = COALESCE(NULLIF($14, ''), sku),
       supplier = COALESCE($15, supplier),
       image = COALESCE($16, image),
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
      input.prices.bj,
      input.prices.ca,
      input.prices.us,
      input.stock,
      input.featured,
      input.sku ?? "",
      input.supplier ?? null,
      input.image ?? null,
    ]
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
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
