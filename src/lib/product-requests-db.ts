import { ensureSchema, getPool } from "./db";

export interface ProductRequestInput {
  productName: string;
  description: string;
  phone: string;
  email: string;
}

export interface ProductRequest extends ProductRequestInput {
  id: number;
  createdAt: string;
  emailSent: boolean;
  handled: boolean;
}

interface ProductRequestRow {
  id: number;
  created_at: string;
  product_name: string;
  description: string;
  phone: string;
  email: string;
  email_sent: boolean;
  handled: boolean;
}

function rowToRequest(row: ProductRequestRow): ProductRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    productName: row.product_name,
    description: row.description,
    phone: row.phone,
    email: row.email,
    emailSent: row.email_sent,
    handled: row.handled,
  };
}

export async function createProductRequest(
  input: ProductRequestInput
): Promise<ProductRequest> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRequestRow>(
    `INSERT INTO product_requests (product_name, description, phone, email)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [input.productName, input.description, input.phone, input.email]
  );
  return rowToRequest(rows[0]);
}

export async function markProductRequestEmailSent(id: number): Promise<void> {
  await ensureSchema();
  await getPool().query(
    "UPDATE product_requests SET email_sent = true WHERE id = $1",
    [id]
  );
}

export async function getAllProductRequests(): Promise<ProductRequest[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRequestRow>(
    "SELECT * FROM product_requests ORDER BY created_at DESC"
  );
  return rows.map(rowToRequest);
}

export async function getProductRequestById(
  id: number
): Promise<ProductRequest | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ProductRequestRow>(
    "SELECT * FROM product_requests WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToRequest(rows[0]) : null;
}

export async function setProductRequestHandled(
  id: number,
  handled: boolean
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    "UPDATE product_requests SET handled = $2 WHERE id = $1",
    [id, handled]
  );
}

export async function deleteProductRequest(id: number): Promise<void> {
  await ensureSchema();
  await getPool().query("DELETE FROM product_requests WHERE id = $1", [id]);
}

export async function deleteProductRequests(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureSchema();
  await getPool().query("DELETE FROM product_requests WHERE id = ANY($1)", [
    ids,
  ]);
}
