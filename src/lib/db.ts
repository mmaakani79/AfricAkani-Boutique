import { Pool } from "pg";
import { SEED_PRODUCTS } from "./seed-products";

declare global {
  var __pgPool: Pool | undefined;
  var __schemaReady: Promise<void> | undefined;
}

function connectionString(): string {
  const url =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Set POSTGRES_URL (Vercel Postgres injects this automatically once the Storage integration is added)."
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString: connectionString(),
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
  return global.__pgPool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  halal TEXT NOT NULL,
  unit TEXT NOT NULL,
  packaging TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_bj NUMERIC NOT NULL,
  price_ca NUMERIC NOT NULL,
  price_us NUMERIC NOT NULL,
  stock TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  zone_id TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  free_shipping_reached BOOLEAN NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL
);
`;

async function seedIfEmpty(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM products"
  );
  if (Number(rows[0].count) > 0) return;

  for (const p of SEED_PRODUCTS) {
    await pool.query(
      `INSERT INTO products
        (id, slug, name, category_id, halal, unit, packaging, description, price_bj, price_ca, price_us, stock, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.slug,
        p.name,
        p.categoryId,
        p.halal,
        p.unit,
        p.packaging,
        p.description,
        p.prices.bj,
        p.prices.ca,
        p.prices.us,
        p.stock,
        p.featured ?? false,
      ]
    );
  }
}

export function ensureSchema(): Promise<void> {
  if (!global.__schemaReady) {
    global.__schemaReady = (async () => {
      const pool = getPool();
      await pool.query(SCHEMA_SQL);
      await seedIfEmpty();
    })();
  }
  return global.__schemaReady;
}
