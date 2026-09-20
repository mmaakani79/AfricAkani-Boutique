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
  price_bj: string;
  price_ca: string;
  price_us: string;
  stock: string;
  featured: boolean;
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
      bj: Number(row.price_bj),
      ca: Number(row.price_ca),
      us: Number(row.price_us),
    },
    stock: row.stock as StockStatus,
    featured: row.featured,
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
  prices: { bj: number; ca: number; us: number };
  stock: StockStatus;
  featured: boolean;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRow>(
    `INSERT INTO products
      (id, slug, name, category_id, halal, unit, packaging, description, price_bj, price_ca, price_us, stock, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
       price_us = $11, stock = $12, featured = $13, updated_at = now()
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

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
