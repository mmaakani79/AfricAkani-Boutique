import { ensureSchema, getPool } from "./db";
import type { MobileMoneyOperator, MobileMoneyConfig } from "./mobile-money-types";

export type { MobileMoneyOperator, MobileMoneyConfig } from "./mobile-money-types";

interface OperatorRow {
  id: string;
  name: string;
  merchant_number: string;
  display_name: string;
  active: boolean;
  sort_order: number;
}

function rowToOperator(row: OperatorRow): MobileMoneyOperator {
  return {
    id: row.id,
    name: row.name,
    merchantNumber: row.merchant_number,
    displayName: row.display_name,
    active: row.active,
  };
}

export async function getBeneficiaryName(): Promise<string> {
  await ensureSchema();
  const { rows } = await getPool().query<{ beneficiary_name: string }>(
    "SELECT beneficiary_name FROM mobile_money_settings WHERE id = 1"
  );
  return rows[0]?.beneficiary_name ?? "";
}

export async function setBeneficiaryName(name: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO mobile_money_settings (id, beneficiary_name)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET beneficiary_name = EXCLUDED.beneficiary_name`,
    [name]
  );
}

export async function getAllOperators(): Promise<MobileMoneyOperator[]> {
  await ensureSchema();
  const { rows } = await getPool().query<OperatorRow>(
    "SELECT * FROM mobile_money_operators ORDER BY sort_order ASC, name ASC"
  );
  return rows.map(rowToOperator);
}

export async function getActiveOperators(): Promise<MobileMoneyOperator[]> {
  const all = await getAllOperators();
  return all.filter((op) => op.active);
}

export async function getOperator(id: string): Promise<MobileMoneyOperator | null> {
  await ensureSchema();
  const { rows } = await getPool().query<OperatorRow>(
    "SELECT * FROM mobile_money_operators WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToOperator(rows[0]) : null;
}

export async function getMobileMoneyConfig(): Promise<MobileMoneyConfig> {
  const [beneficiaryName, operators] = await Promise.all([
    getBeneficiaryName(),
    getActiveOperators(),
  ]);
  return { beneficiaryName, operators };
}

export async function createOperator(input: {
  name: string;
  merchantNumber: string;
  displayName?: string;
}): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query<{ max: number | null }>(
    "SELECT max(sort_order) AS max FROM mobile_money_operators"
  );
  const nextSort = (rows[0]?.max ?? -1) + 1;
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await pool.query(
    `INSERT INTO mobile_money_operators (id, name, merchant_number, display_name, sort_order)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, input.name, input.merchantNumber, input.displayName ?? "", nextSort]
  );
}

export async function updateOperator(
  id: string,
  input: {
    name: string;
    merchantNumber: string;
    displayName: string;
    active: boolean;
  }
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE mobile_money_operators
     SET name = $2, merchant_number = $3, display_name = $4, active = $5
     WHERE id = $1`,
    [id, input.name, input.merchantNumber, input.displayName, input.active]
  );
}

export async function deleteOperator(id: string): Promise<void> {
  await ensureSchema();
  await getPool().query("DELETE FROM mobile_money_operators WHERE id = $1", [id]);
}

/** True if this transaction id is already attached to another order. */
export async function isTransactionIdTaken(transactionId: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT 1 FROM orders WHERE mobile_money_transaction_id = $1 LIMIT 1",
    [transactionId]
  );
  return rows.length > 0;
}
