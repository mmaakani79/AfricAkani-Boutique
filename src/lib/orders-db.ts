import { ensureSchema, getPool } from "./db";
import type { ZoneId } from "./types";
import type { OrderStatus, PaymentStatus } from "./order-types";

export type { OrderStatus, PaymentStatus } from "./order-types";
export { ORDER_STATUSES, PAYMENT_STATUSES } from "./order-types";

export interface OrderItemInput {
  productId: string;
  name: string;
  sku?: string | null;
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
        `INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          input.id,
          item.productId,
          item.name,
          item.sku ?? null,
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

export interface OrderSummary {
  id: string;
  createdAt: string;
  zoneId: ZoneId;
  subtotal: number;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  isTest: boolean;
}

interface OrderSummaryRow {
  id: string;
  created_at: string;
  zone_id: string;
  subtotal: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  is_test: boolean;
}

function rowToSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    zoneId: row.zone_id as ZoneId,
    subtotal: Number(row.subtotal),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    isTest: row.is_test,
  };
}

export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  zoneId?: ZoneId;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  includeTest?: boolean;
}

function buildOrderFilters(filters: OrderFilters, startIndex = 1) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (filters.status) {
    clauses.push(`status = $${i++}`);
    params.push(filters.status);
  }
  if (filters.paymentStatus) {
    clauses.push(`payment_status = $${i++}`);
    params.push(filters.paymentStatus);
  }
  if (filters.zoneId) {
    clauses.push(`zone_id = $${i++}`);
    params.push(filters.zoneId);
  }
  if (filters.dateFrom) {
    clauses.push(`created_at >= $${i++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push(`created_at <= $${i++}`);
    params.push(filters.dateTo);
  }
  if (filters.search) {
    clauses.push(`(customer_name ILIKE $${i} OR id ILIKE $${i})`);
    params.push(`%${filters.search}%`);
    i++;
  }
  if (!filters.includeTest) {
    clauses.push(`is_test = false`);
  }

  return { clauses, params, next: i };
}

export async function getAllOrders(
  filters: OrderFilters = {}
): Promise<OrderSummary[]> {
  await ensureSchema();
  const { clauses, params } = buildOrderFilters(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await getPool().query<OrderSummaryRow>(
    `SELECT id, created_at, zone_id, subtotal, customer_name, customer_phone, status, payment_status, is_test
     FROM orders
     ${where}
     ORDER BY created_at DESC`,
    params
  );
  return rows.map(rowToSummary);
}

export interface OrderItemRow {
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderReminder {
  id: number;
  channel: string;
  kind: string;
  note: string | null;
  sentAt: string;
}

export interface OrderDetail extends OrderSummary {
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  freeShippingReached: boolean;
  paymentMethod: string | null;
  reminder24hSentAt: string | null;
  reminder48hSentAt: string | null;
  emailError: string | null;
  items: OrderItemRow[];
  reminders: OrderReminder[];
}

interface OrderFullRow {
  id: string;
  created_at: string;
  zone_id: string;
  subtotal: string;
  free_shipping_reached: boolean;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  is_test: boolean;
  reminder_24h_sent_at: string | null;
  reminder_48h_sent_at: string | null;
  email_error: string | null;
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows: orderRows } = await pool.query<OrderFullRow>(
    "SELECT * FROM orders WHERE id = $1",
    [id]
  );
  const order = orderRows[0];
  if (!order) return null;

  const { rows: itemRows } = await pool.query<{
    product_id: string;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    unit_price: string;
    line_total: string;
  }>(
    "SELECT product_id, product_name, product_sku, quantity, unit_price, line_total FROM order_items WHERE order_id = $1 ORDER BY id ASC",
    [id]
  );

  const { rows: reminderRows } = await pool.query<{
    id: number;
    channel: string;
    kind: string;
    note: string | null;
    sent_at: string;
  }>(
    "SELECT id, channel, kind, note, sent_at FROM order_reminders WHERE order_id = $1 ORDER BY sent_at DESC",
    [id]
  );

  return {
    id: order.id,
    createdAt: order.created_at,
    zoneId: order.zone_id as ZoneId,
    subtotal: Number(order.subtotal),
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    customerAddress: order.customer_address,
    customerCity: order.customer_city,
    freeShippingReached: order.free_shipping_reached,
    status: order.status as OrderStatus,
    paymentStatus: order.payment_status as PaymentStatus,
    paymentMethod: order.payment_method,
    isTest: order.is_test,
    reminder24hSentAt: order.reminder_24h_sent_at,
    reminder48hSentAt: order.reminder_48h_sent_at,
    emailError: order.email_error,
    items: itemRows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      productSku: r.product_sku,
      quantity: r.quantity,
      unitPrice: Number(r.unit_price),
      lineTotal: Number(r.line_total),
    })),
    reminders: reminderRows.map((r) => ({
      id: r.id,
      channel: r.channel,
      kind: r.kind,
      note: r.note,
      sentAt: r.sent_at,
    })),
  };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "UPDATE orders SET status = $2, status_updated_at = now() WHERE id = $1",
    [id, status]
  );
  return (rowCount ?? 0) > 0;
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  paymentMethod?: string | null
): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `UPDATE orders
     SET payment_status = $2,
         payment_method = COALESCE($3, payment_method),
         payment_status_updated_at = now()
     WHERE id = $1`,
    [id, paymentStatus, paymentMethod ?? null]
  );
  return (rowCount ?? 0) > 0;
}

/** Records the last e-mail send outcome for this order (null clears it on success). */
export async function setOrderEmailError(
  id: string,
  message: string | null
): Promise<void> {
  await ensureSchema();
  await getPool().query("UPDATE orders SET email_error = $2 WHERE id = $1", [
    id,
    message,
  ]);
}

export async function setOrderTest(id: string, isTest: boolean): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "UPDATE orders SET is_test = $2 WHERE id = $1",
    [id, isTest]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteOrder(id: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "DELETE FROM orders WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}

export async function recordReminder(
  orderId: string,
  channel: "email" | "whatsapp",
  kind: string,
  note?: string
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    "INSERT INTO order_reminders (order_id, channel, kind, note) VALUES ($1,$2,$3,$4)",
    [orderId, channel, kind, note ?? null]
  );
}

export async function getPendingPaymentOrders(): Promise<OrderSummary[]> {
  return getAllOrders({ paymentStatus: "en_attente", includeTest: false });
}

interface ReminderCandidateRow extends OrderSummaryRow {
  customer_email: string;
}

/** Orders past `sinceHours` old, still unpaid, not yet reminded via `column`. */
export async function getOrdersDueForReminder(
  sinceHours: number,
  column: "reminder_24h_sent_at" | "reminder_48h_sent_at"
): Promise<(OrderSummary & { customerEmail: string })[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ReminderCandidateRow>(
    `SELECT id, created_at, zone_id, subtotal, customer_name, customer_phone, customer_email, status, payment_status, is_test
     FROM orders
     WHERE payment_status = 'en_attente'
       AND is_test = false
       AND status != 'annulee'
       AND ${column} IS NULL
       AND created_at <= now() - ($1 || ' hours')::interval
     ORDER BY created_at ASC`,
    [sinceHours]
  );
  return rows.map((r) => ({ ...rowToSummary(r), customerEmail: r.customer_email }));
}

export async function markReminderColumnSent(
  id: string,
  column: "reminder_24h_sent_at" | "reminder_48h_sent_at"
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE orders SET ${column} = now() WHERE id = $1`,
    [id]
  );
}

export interface CancellableOrder extends OrderSummary {
  customerEmail: string;
}

/** Unpaid orders older than `timeoutHours`, not already cancelled — cancels them and returns them for notification. */
export async function cancelExpiredOrders(
  timeoutHours: number
): Promise<CancellableOrder[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ReminderCandidateRow>(
    `UPDATE orders
     SET status = 'annulee', status_updated_at = now()
     WHERE payment_status = 'en_attente'
       AND is_test = false
       AND status != 'annulee'
       AND created_at <= now() - ($1 || ' hours')::interval
     RETURNING id, created_at, zone_id, subtotal, customer_name, customer_phone, customer_email, status, payment_status, is_test`,
    [timeoutHours]
  );
  return rows.map((r) => ({ ...rowToSummary(r), customerEmail: r.customer_email }));
}

export interface DashboardStats {
  orderCount: number;
  revenueByZone: { zoneId: ZoneId; total: number }[];
  topProducts: { productId: string; name: string; quantity: number }[];
  ordersByDay: { day: string; count: number }[];
  pendingPaymentCount: number;
  pendingPaymentByZone: { zoneId: ZoneId; count: number; total: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureSchema();
  const pool = getPool();

  const [
    { rows: countRows },
    { rows: revenueRows },
    { rows: topRows },
    { rows: dayRows },
    { rows: pendingRows },
  ] = await Promise.all([
    pool.query<{ count: string }>(
      "SELECT count(*)::text FROM orders WHERE payment_status = 'paye' AND is_test = false"
    ),
    pool.query<{ zone_id: string; total: string }>(
      `SELECT zone_id, sum(subtotal)::text AS total FROM orders
       WHERE payment_status = 'paye' AND is_test = false
       GROUP BY zone_id`
    ),
    pool.query<{ product_id: string; name: string; quantity: string }>(
      `SELECT oi.product_id, oi.product_name AS name, sum(oi.quantity)::text AS quantity
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status = 'paye' AND o.is_test = false
       GROUP BY oi.product_id, oi.product_name
       ORDER BY sum(oi.quantity) DESC
       LIMIT 5`
    ),
    pool.query<{ day: string; count: string }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::text AS count
       FROM orders
       WHERE payment_status = 'paye' AND is_test = false
       GROUP BY day
       ORDER BY day DESC
       LIMIT 14`
    ),
    pool.query<{ zone_id: string; count: string; total: string }>(
      `SELECT zone_id, count(*)::text AS count, coalesce(sum(subtotal), 0)::text AS total
       FROM orders
       WHERE payment_status = 'en_attente' AND is_test = false AND status != 'annulee'
       GROUP BY zone_id`
    ),
  ]);

  const pendingPaymentByZone = pendingRows.map((r) => ({
    zoneId: r.zone_id as ZoneId,
    count: Number(r.count),
    total: Number(r.total),
  }));

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
    pendingPaymentCount: pendingPaymentByZone.reduce((sum, z) => sum + z.count, 0),
    pendingPaymentByZone,
  };
}
