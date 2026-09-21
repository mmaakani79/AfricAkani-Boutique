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
  price_bj NUMERIC,
  price_ca NUMERIC,
  price_us NUMERIC,
  stock TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  sku TEXT,
  supplier TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- price_bj/ca/us predate the "empty price = not sold in this zone" rule and
-- were NOT NULL; relax that for installs created before this migration.
ALTER TABLE products ALTER COLUMN price_bj DROP NOT NULL;
ALTER TABLE products ALTER COLUMN price_ca DROP NOT NULL;
ALTER TABLE products ALTER COLUMN price_us DROP NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (sku);

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
  customer_city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  payment_status TEXT NOT NULL DEFAULT 'en_attente',
  payment_method TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_48h_sent_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_error TEXT,
  shipping_fee NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'nouvelle';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'en_attente';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_48h_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_error TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS shipping_settings (
  zone_id TEXT PRIMARY KEY,
  free_shipping_threshold NUMERIC NOT NULL,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku TEXT;

CREATE TABLE IF NOT EXISTS order_reminders (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_requests (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  product_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  email_sent BOOLEAN NOT NULL DEFAULT false
);
`;

async function backfillProductSkus(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE products SET sku = 'AK-' || upper(id) WHERE sku IS NULL`
  );
}

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
      await backfillProductSkus();
    })();
  }
  return global.__schemaReady;
}
