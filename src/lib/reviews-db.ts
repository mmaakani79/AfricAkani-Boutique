import { ensureSchema, getPool } from "./db";
import type { ReviewStatus } from "./review-types";

export interface Review {
  id: number;
  productId: string;
  productName: string;
  orderId: string | null;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
}

interface ReviewRow {
  id: number;
  product_id: string;
  product_name: string | null;
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
}

function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name ?? "",
    orderId: row.order_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    rating: row.rating,
    comment: row.comment,
    status: row.status as ReviewStatus,
    createdAt: row.created_at,
  };
}

const REVIEW_SELECT = `r.*, p.name AS product_name FROM product_reviews r
   LEFT JOIN products p ON p.id = r.product_id`;

/** Published reviews for a product's "Avis clients" section — newest first. */
export async function getApprovedReviewsForProduct(
  productId: string
): Promise<Review[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ReviewRow>(
    `SELECT ${REVIEW_SELECT} WHERE r.product_id = $1 AND r.status = 'approuvee' ORDER BY r.created_at DESC`,
    [productId]
  );
  return rows.map(rowToReview);
}

export async function getAllReviews(status?: ReviewStatus): Promise<Review[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ReviewRow>(
    status
      ? `SELECT ${REVIEW_SELECT} WHERE r.status = $1 ORDER BY r.created_at DESC`
      : `SELECT ${REVIEW_SELECT} ORDER BY r.created_at DESC`,
    status ? [status] : []
  );
  return rows.map(rowToReview);
}

/** Existing reviews left for an order — used to prefill the review form on /noter. */
export async function getReviewsForOrder(orderId: string): Promise<Review[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ReviewRow>(
    `SELECT ${REVIEW_SELECT} WHERE r.order_id = $1`,
    [orderId]
  );
  return rows.map(rowToReview);
}

export interface ReviewInput {
  productId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
}

/** Creates a review, or replaces the customer's existing one for the same
 *  order+product — resets it to "en_attente" so it's re-moderated. */
export async function submitReview(input: ReviewInput): Promise<void> {
  await ensureSchema();
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  await getPool().query(
    `INSERT INTO product_reviews (product_id, order_id, customer_name, customer_email, rating, comment, status)
     VALUES ($1,$2,$3,$4,$5,$6,'en_attente')
     ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL DO UPDATE SET
       rating = EXCLUDED.rating,
       comment = EXCLUDED.comment,
       customer_name = EXCLUDED.customer_name,
       status = 'en_attente',
       created_at = now()`,
    [
      input.productId,
      input.orderId,
      input.customerName,
      input.customerEmail,
      rating,
      input.comment.trim(),
    ]
  );
}

export async function setReviewStatus(
  id: number,
  status: ReviewStatus
): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "UPDATE product_reviews SET status = $2 WHERE id = $1",
    [id, status]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteReview(id: number): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "DELETE FROM product_reviews WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}
