import { Pool } from "pg";
import { SEED_PRODUCTS } from "./seed-products";
import { SEED_CATEGORIES } from "./seed-categories";
import { SEED_PACKAGING_TYPES } from "./seed-packaging-types";

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
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  featured_home BOOLEAN NOT NULL DEFAULT false,
  photo_seed TEXT NOT NULL DEFAULT 'emerald',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packaging_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  halal TEXT NOT NULL,
  unit TEXT NOT NULL,
  packaging TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
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
ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (sku);

-- Extra quantity-pricing steps beyond the base price (min_qty > 1 — the base
-- price_bj/ca/us columns above already cover "1 unit and up").
CREATE TABLE IF NOT EXISTS product_price_tiers (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL,
  min_qty INTEGER NOT NULL CHECK (min_qty > 1),
  unit_price NUMERIC NOT NULL,
  UNIQUE (product_id, zone_id, min_qty)
);
CREATE INDEX IF NOT EXISTS product_price_tiers_product_idx ON product_price_tiers (product_id);

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
  customer_apartment TEXT,
  customer_province TEXT,
  customer_postal_code TEXT,
  customer_country TEXT,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  payment_status TEXT NOT NULL DEFAULT 'en_attente',
  payment_method TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_48h_sent_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_error TEXT,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  mobile_money_operator TEXT,
  mobile_money_phone TEXT,
  mobile_money_transaction_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paypal_order_id TEXT,
  paypal_capture_id TEXT
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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mobile_money_operator TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mobile_money_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mobile_money_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_apartment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_province TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_postal_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_country TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_invite_sent_at TIMESTAMPTZ;

-- A transaction id can only ever be claimed by one order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_mobile_money_txn_key
  ON orders (mobile_money_transaction_id)
  WHERE mobile_money_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS shipping_settings (
  zone_id TEXT PRIMARY KEY,
  free_shipping_threshold NUMERIC NOT NULL,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_money_operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  merchant_number TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mobile_money_operators ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS mobile_money_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  beneficiary_name TEXT NOT NULL DEFAULT '',
  CONSTRAINT mobile_money_settings_singleton CHECK (id = 1)
);

-- password_hash overrides ADMIN_PASSWORD once an admin changes it from the
-- UI; NULL means "still using the ADMIN_PASSWORD environment variable".
CREATE TABLE IF NOT EXISTS admin_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  password_hash TEXT,
  CONSTRAINT admin_settings_singleton CHECK (id = 1)
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
  email_sent BOOLEAN NOT NULL DEFAULT false,
  handled BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS handled BOOLEAN NOT NULL DEFAULT false;

-- One review per (order, product): the customer can resubmit before it's
-- moderated (ON CONFLICT ... DO UPDATE), but never leave two for the same
-- purchase. order_id is nullable so a review survives its order being
-- deleted (moderation history shouldn't vanish with it).
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_order_product_key
  ON product_reviews (order_id, product_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS product_reviews_status_idx ON product_reviews (status);

-- contract_text is admin-editable from /admin/contrats — never hardcoded,
-- since only AkaGestSoft can supply the real, legally-reviewed wording.
CREATE TABLE IF NOT EXISTS contract_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  contract_text TEXT NOT NULL DEFAULT '',
  CONSTRAINT contract_settings_singleton CHECK (id = 1)
);

-- contract_text_snapshot freezes the wording the client actually read and
-- signed, so a later edit to contract_settings never rewrites history.
CREATE TABLE IF NOT EXISTS signed_contracts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  company_name TEXT,
  services TEXT[] NOT NULL DEFAULT '{}',
  project_description TEXT NOT NULL DEFAULT '',
  budget TEXT,
  timeline TEXT,
  notes TEXT,
  contract_text_snapshot TEXT NOT NULL,
  signature_data_url TEXT NOT NULL
);
`;

async function backfillProductSkus(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE products SET sku = 'AK-' || upper(id) WHERE sku IS NULL`
  );
}

async function seedCategoriesIfEmpty(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM categories"
  );
  if (Number(rows[0].count) > 0) return;

  for (let i = 0; i < SEED_CATEGORIES.length; i++) {
    const c = SEED_CATEGORIES[i];
    await pool.query(
      `INSERT INTO categories (id, slug, name, description, featured_home, photo_seed, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.slug, c.name, c.description, c.featuredHome ?? false, c.photoSeed, i]
    );
  }
}

async function seedPackagingTypesIfEmpty(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM packaging_types"
  );
  if (Number(rows[0].count) > 0) return;

  for (let i = 0; i < SEED_PACKAGING_TYPES.length; i++) {
    const p = SEED_PACKAGING_TYPES[i];
    await pool.query(
      `INSERT INTO packaging_types (id, name, sort_order)
       VALUES ($1,$2,$3)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, i]
    );
  }
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

const DEFAULT_MOBILE_MONEY_OPERATORS = [
  { id: "mtn", name: "MTN" },
  { id: "moov", name: "Moov" },
  { id: "celtiis", name: "Celtiis" },
];

async function seedMobileMoneyIfEmpty(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mobile_money_settings (id, beneficiary_name)
     VALUES (1, '')
     ON CONFLICT (id) DO NOTHING`
  );

  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM mobile_money_operators"
  );
  if (Number(rows[0].count) > 0) return;

  for (let i = 0; i < DEFAULT_MOBILE_MONEY_OPERATORS.length; i++) {
    const op = DEFAULT_MOBILE_MONEY_OPERATORS[i];
    await pool.query(
      `INSERT INTO mobile_money_operators (id, name, merchant_number, sort_order)
       VALUES ($1, $2, '', $3)
       ON CONFLICT (id) DO NOTHING`,
      [op.id, op.name, i]
    );
  }
}

// Generic starting-point wording, editable any time from /admin/contrats —
// AkaGestSoft should review/customize it (ideally with a lawyer) before
// relying on it as a real, binding contract.
const DEFAULT_CONTRACT_TEXT = `CONTRAT DE PRESTATION DE SERVICES — AKAGESTSOFT

Entre AkaGestSoft (« le Prestataire ») et le client identifié dans le formulaire ci-dessous (« le Client »), il est convenu ce qui suit :

1. Objet
Le présent contrat a pour objet la réalisation par le Prestataire des services décrits dans le cahier des charges rempli par le Client (boutique en ligne, site web, application de gestion, matériel et achats, réseau et cybersécurité, ou toute combinaison de ces services).

2. Déroulement de la prestation
Le Prestataire échange avec le Client pour préciser ses besoins, réalise la prestation convenue, puis forme le Client à l'utilisation des outils livrés et reste disponible pour un accompagnement après livraison.

3. Prix et modalités de paiement
Le prix de la prestation est établi d'un commun accord sur la base du budget et des besoins décrits dans le cahier des charges, et fait l'objet d'un devis ou d'une facture distincte. Les modalités de paiement (acompte, échéancier) sont précisées avec le Client avant le démarrage des travaux.

4. Délais
Les délais de réalisation sont estimés d'un commun accord et communiqués au Client ; ils peuvent être ajustés en cas de modification du périmètre du projet en cours de réalisation.

5. Propriété et livrables
Sauf accord contraire, les livrables (code, contenus, configurations) sont remis au Client à l'issue du projet et après règlement intégral du prix convenu.

6. Confidentialité
Chaque partie s'engage à garder confidentielles les informations échangées dans le cadre de cette prestation.

7. Résiliation
Le présent contrat peut être résilié par l'une ou l'autre des parties moyennant un préavis écrit raisonnable, sans préjudice des sommes dues pour les travaux déjà réalisés.

8. Acceptation
En signant électroniquement ci-dessous, le Client reconnaît avoir lu, compris et accepté les termes du présent contrat ainsi que les informations qu'il a fournies dans le cahier des charges ci-joint.`;

async function seedContractTextIfEmpty(): Promise<void> {
  await getPool().query(
    `INSERT INTO contract_settings (id, contract_text)
     VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_CONTRACT_TEXT]
  );
}

export function ensureSchema(): Promise<void> {
  if (!global.__schemaReady) {
    global.__schemaReady = (async () => {
      const pool = getPool();
      await pool.query(SCHEMA_SQL);
      await seedCategoriesIfEmpty();
      await seedPackagingTypesIfEmpty();
      await seedIfEmpty();
      await backfillProductSkus();
      await seedMobileMoneyIfEmpty();
      await seedContractTextIfEmpty();
    })();
  }
  return global.__schemaReady;
}
