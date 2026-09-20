import { ensureSchema, getPool } from "./db";
import type { ZoneId } from "./types";

export interface OrderItemInput {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderInput {
  id: string;
  zoneId: ZoneId;
  subtotal: number;
  freeShippingReached: boolean;
  items: OrderItemInput[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
}

export async function createOrder(input: OrderInput): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO orders
        (id, zone_id, subtotal, free_shipping_reached, customer_name, customer_email, customer_phone, customer_address, customer_city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.id,
        input.zoneId,
        input.subtotal,
        input.freeShippingReached,
        input.customer.name,
        input.customer.email,
        input.customer.phone,
        input.customer.address,
        input.customer.city,
      ]
    );
    for (const item of input.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          input.id,
          item.productId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface DashboardStats {
  orderCount: number;
  revenueByZone: { zoneId: ZoneId; total: number }[];
  topProducts: { productId: string; name: string; quantity: number }[];
  ordersByDay: { day: string; count: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureSchema();
  const pool = getPool();

  const [{ rows: countRows }, { rows: revenueRows }, { rows: topRows }, { rows: dayRows }] =
    await Promise.all([
      pool.query<{ count: string }>("SELECT count(*)::text FROM orders"),
      pool.query<{ zone_id: string; total: string }>(
        "SELECT zone_id, sum(subtotal)::text AS total FROM orders GROUP BY zone_id"
      ),
      pool.query<{ product_id: string; name: string; quantity: string }>(
        `SELECT product_id, product_name AS name, sum(quantity)::text AS quantity
         FROM order_items
         GROUP BY product_id, product_name
         ORDER BY sum(quantity) DESC
         LIMIT 5`
      ),
      pool.query<{ day: string; count: string }>(
        `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::text AS count
         FROM orders
         GROUP BY day
         ORDER BY day DESC
         LIMIT 14`
      ),
    ]);

  return {
    orderCount: Number(countRows[0]?.count ?? 0),
    revenueByZone: revenueRows.map((r) => ({
      zoneId: r.zone_id as ZoneId,
      total: Number(r.total),
    })),
    topProducts: topRows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      quantity: Number(r.quantity),
    })),
    ordersByDay: dayRows.map((r) => ({ day: r.day, count: Number(r.count) })),
  };
}
