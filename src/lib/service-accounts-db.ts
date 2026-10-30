import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "./db";
import { getOperator } from "./mobile-money-db";
import {
  computeAccountState,
  todayInBenin,
  type AccountState,
  type AdjustmentKind,
  type PaymentStatus,
} from "./service-account-math";
import { generateServiceToken, hashServiceToken, isPlausibleServiceToken, randomServiceId } from "./service-token";
import type {
  AdminPaymentInput,
  MobileMoneySubmission,
  NewAccountInput,
} from "./service-validation";

// Database access for the service payment files (tables: service_*). Dates are
// YYYY-MM-DD strings and timestamps ISO strings, so everything here can be handed
// to a client component. Rows are never deleted; see the guards in db.ts.

export interface ServiceInstallment {
  position: number;
  label: string;
  dueDate: string;
}

export interface ServicePayment {
  id: string;
  accountId: string;
  createdAt: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  source: "client" | "admin";
  paidOn: string | null;
  mmOperator: string | null;
  mmPhone: string | null;
  mmTransactionId: string | null;
  reference: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  adminEmailSentAt: string | null;
  adminEmailError: string | null;
  receiptSentAt: string | null;
  receiptError: string | null;
  receiptClaimedAt: string | null;
}

export interface ServiceAdjustment {
  id: string;
  accountId: string;
  createdAt: string;
  kind: AdjustmentKind;
  amount: number;
  reason: string;
}

export interface ServiceEvent {
  id: number;
  createdAt: string;
  kind: string;
  detail: string;
}

export interface ServiceAccount {
  id: string;
  createdAt: string;
  merchantName: string;
  /** Where the receipts go (copied from the signed contract, editable). */
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  contractId: string | null;
  total: number;
  deposit: number;
  installmentsCount: number;
  goLiveDate: string | null;
  followupAmount: number;
  followupPeriod: "month" | "quarter";
  note: string;
  tokenCreatedAt: string;
}

export interface ServiceAccountFull {
  account: ServiceAccount;
  installments: ServiceInstallment[];
  payments: ServicePayment[];
  adjustments: ServiceAdjustment[];
  state: AccountState;
}

export interface ServiceAccountSummary extends ServiceAccountFull {
  /** Payments waiting for the admin's confirmation. */
  pendingCount: number;
}

const ACCOUNT_COLUMNS = `id, created_at, merchant_name, contract_id, total_amount, deposit_amount,
  installments_count, to_char(go_live_date, 'YYYY-MM-DD') AS go_live_date, followup_amount,
  followup_period, note, token_created_at, client_name, client_email, client_phone`;

interface AccountRow {
  id: string;
  created_at: Date;
  merchant_name: string;
  contract_id: string | null;
  total_amount: number;
  deposit_amount: number;
  installments_count: number;
  go_live_date: string | null;
  followup_amount: number;
  followup_period: string;
  note: string;
  token_created_at: Date;
  client_name: string;
  client_email: string;
  client_phone: string;
}

function rowToAccount(r: AccountRow): ServiceAccount {
  return {
    id: r.id,
    createdAt: r.created_at.toISOString(),
    merchantName: r.merchant_name,
    clientName: r.client_name,
    clientEmail: r.client_email,
    clientPhone: r.client_phone,
    contractId: r.contract_id,
    total: r.total_amount,
    deposit: r.deposit_amount,
    installmentsCount: r.installments_count,
    goLiveDate: r.go_live_date,
    followupAmount: r.followup_amount,
    followupPeriod: r.followup_period === "quarter" ? "quarter" : "month",
    note: r.note,
    tokenCreatedAt: r.token_created_at.toISOString(),
  };
}

const PAYMENT_COLUMNS = `id, account_id, created_at, amount, method, status, source,
  to_char(paid_on, 'YYYY-MM-DD') AS paid_on, mm_operator, mm_phone, mm_transaction_id, reference,
  confirmed_at, rejected_at, reject_reason, admin_email_sent_at, admin_email_error,
  receipt_sent_at, receipt_error, receipt_claimed_at`;

interface PaymentRow {
  id: string;
  account_id: string;
  created_at: Date;
  amount: number;
  method: string;
  status: string;
  source: string;
  paid_on: string | null;
  mm_operator: string | null;
  mm_phone: string | null;
  mm_transaction_id: string | null;
  reference: string;
  confirmed_at: Date | null;
  rejected_at: Date | null;
  reject_reason: string | null;
  admin_email_sent_at: Date | null;
  admin_email_error: string | null;
  receipt_sent_at: Date | null;
  receipt_error: string | null;
  receipt_claimed_at: Date | null;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function rowToPayment(r: PaymentRow): ServicePayment {
  return {
    id: r.id,
    accountId: r.account_id,
    createdAt: r.created_at.toISOString(),
    amount: r.amount,
    method: r.method,
    status: r.status as PaymentStatus,
    source: r.source === "admin" ? "admin" : "client",
    paidOn: r.paid_on,
    mmOperator: r.mm_operator,
    mmPhone: r.mm_phone,
    mmTransactionId: r.mm_transaction_id,
    reference: r.reference,
    confirmedAt: iso(r.confirmed_at),
    rejectedAt: iso(r.rejected_at),
    rejectReason: r.reject_reason,
    adminEmailSentAt: iso(r.admin_email_sent_at),
    adminEmailError: r.admin_email_error,
    receiptSentAt: iso(r.receipt_sent_at),
    receiptError: r.receipt_error,
    receiptClaimedAt: iso(r.receipt_claimed_at),
  };
}

function buildState(
  account: ServiceAccount,
  installments: ServiceInstallment[],
  payments: ServicePayment[],
  adjustments: ServiceAdjustment[]
): AccountState {
  return computeAccountState({
    total: account.total,
    deposit: account.deposit,
    installments,
    payments,
    adjustments,
    today: todayInBenin(),
  });
}

async function loadFull(accountRows: AccountRow[]): Promise<ServiceAccountFull[]> {
  if (accountRows.length === 0) return [];
  const pool = getPool();
  const ids = accountRows.map((r) => r.id);
  const [inst, pays, adjs] = await Promise.all([
    pool.query<{ account_id: string; position: number; label: string; due_date: string }>(
      `SELECT account_id, position, label, to_char(due_date, 'YYYY-MM-DD') AS due_date
         FROM service_installments WHERE account_id = ANY($1) ORDER BY account_id, position`,
      [ids]
    ),
    pool.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM service_payments WHERE account_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    ),
    pool.query<{ id: string; account_id: string; created_at: Date; kind: string; amount: number; reason: string }>(
      `SELECT id, account_id, created_at, kind, amount, reason
         FROM service_adjustments WHERE account_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    ),
  ]);
  return accountRows.map((row) => {
    const account = rowToAccount(row);
    const installments = inst.rows
      .filter((r) => r.account_id === row.id)
      .map((r) => ({ position: r.position, label: r.label, dueDate: r.due_date }));
    const payments = pays.rows.filter((r) => r.account_id === row.id).map(rowToPayment);
    const adjustments: ServiceAdjustment[] = adjs.rows
      .filter((r) => r.account_id === row.id)
      .map((r) => ({
        id: r.id,
        accountId: r.account_id,
        createdAt: r.created_at.toISOString(),
        kind: r.kind as AdjustmentKind,
        amount: r.amount,
        reason: r.reason,
      }));
    return { account, installments, payments, adjustments, state: buildState(account, installments, payments, adjustments) };
  });
}

async function addEvent(
  client: Pick<PoolClient, "query"> | ReturnType<typeof getPool>,
  accountId: string,
  kind: string,
  detail: string
): Promise<void> {
  await client.query("INSERT INTO service_events (account_id, kind, detail) VALUES ($1, $2, $3)", [
    accountId,
    kind,
    detail,
  ]);
}

// ---- Reading ----------------------------------------------------------------------------------

export async function listServiceAccounts(): Promise<ServiceAccountSummary[]> {
  await ensureSchema();
  const { rows } = await getPool().query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM service_accounts ORDER BY created_at DESC`
  );
  const full = await loadFull(rows);
  return full.map((f) => ({ ...f, pendingCount: f.payments.filter((p) => p.status === "soumis").length }));
}

export async function getServiceAccountFull(id: string): Promise<ServiceAccountFull | null> {
  await ensureSchema();
  const { rows } = await getPool().query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM service_accounts WHERE id = $1`,
    [id]
  );
  return (await loadFull(rows))[0] ?? null;
}

/** The client's private page: found only by the fingerprint of the secret token. */
export async function getServiceAccountByToken(token: string): Promise<ServiceAccountFull | null> {
  if (!isPlausibleServiceToken(token)) return null;
  await ensureSchema();
  const { rows } = await getPool().query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM service_accounts WHERE token_hash = $1`,
    [hashServiceToken(token)]
  );
  return (await loadFull(rows))[0] ?? null;
}

export async function getServiceEvents(accountId: string): Promise<ServiceEvent[]> {
  await ensureSchema();
  const { rows } = await getPool().query<{ id: string; created_at: Date; kind: string; detail: string }>(
    "SELECT id, created_at, kind, detail FROM service_events WHERE account_id = $1 ORDER BY id DESC LIMIT 200",
    [accountId]
  );
  return rows.map((r) => ({ id: Number(r.id), createdAt: r.created_at.toISOString(), kind: r.kind, detail: r.detail }));
}

export async function countPendingServicePayments(): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query<{ count: string }>(
    "SELECT count(*)::text FROM service_payments WHERE status = 'soumis'"
  );
  return Number(rows[0].count);
}

export interface ServicesDashboardStats {
  accountCount: number;
  /** Confirmed payments minus refunds, across all files. */
  collected: number;
  /** Still to pay, across all files. */
  remaining: number;
  lateCount: number;
  pendingCount: number;
}

export async function getServicesDashboardStats(): Promise<ServicesDashboardStats> {
  const all = await listServiceAccounts();
  return {
    accountCount: all.length,
    collected: all.reduce((s, a) => s + Math.max(0, a.state.paid), 0),
    remaining: all.reduce((s, a) => s + a.state.remaining, 0),
    lateCount: all.filter((a) => a.state.status === "en_retard").length,
    pendingCount: all.reduce((s, a) => s + a.pendingCount, 0),
  };
}

// ---- Creating and editing a file ---------------------------------------------------------------

export async function createServiceAccount(
  input: NewAccountInput
): Promise<{ id: string; token: string }> {
  await ensureSchema();
  const token = generateServiceToken();
  const id = randomServiceId("SV");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO service_accounts
         (id, merchant_name, contract_id, total_amount, deposit_amount, installments_count,
          go_live_date, followup_amount, followup_period, note, token_hash,
          client_name, client_email, client_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        input.merchantName,
        input.contractId,
        input.total,
        input.deposit,
        input.installments.length,
        input.goLiveDate,
        input.followupAmount,
        input.followupPeriod,
        input.note,
        hashServiceToken(token),
        input.clientName,
        input.clientEmail,
        input.clientPhone,
      ]
    );
    for (let i = 0; i < input.installments.length; i++) {
      await client.query(
        "INSERT INTO service_installments (account_id, position, label, due_date) VALUES ($1, $2, $3, $4)",
        [id, i + 1, input.installments[i].label, input.installments[i].dueDate]
      );
    }
    await addEvent(
      client,
      id,
      "dossier_cree",
      `Dossier créé : ${input.total} FCFA, acompte ${input.deposit} FCFA, ${input.installments.length} tranches.`
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return { id, token };
}

export async function updateServiceInstallments(
  accountId: string,
  installments: { label: string; dueDate: string }[]
): Promise<boolean> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ installments_count: number }>(
      "SELECT installments_count FROM service_accounts WHERE id = $1 FOR UPDATE",
      [accountId]
    );
    if (!rows[0] || rows[0].installments_count !== installments.length) {
      await client.query("ROLLBACK");
      return false;
    }
    for (let i = 0; i < installments.length; i++) {
      await client.query(
        "UPDATE service_installments SET label = $3, due_date = $4 WHERE account_id = $1 AND position = $2",
        [accountId, i + 1, installments[i].label, installments[i].dueDate]
      );
    }
    await addEvent(
      client,
      accountId,
      "echeances_modifiees",
      installments.map((t, i) => `${i + 1}. ${t.label || "(sans étiquette)"} — ${t.dueDate}`).join(" ; ")
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateServiceAccountDetails(
  accountId: string,
  details: {
    goLiveDate: string | null;
    note: string;
    followupAmount: number;
    followupPeriod: "month" | "quarter";
    clientName: string;
    clientEmail: string;
    clientPhone: string;
  }
): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `UPDATE service_accounts SET go_live_date = $2, note = $3, followup_amount = $4, followup_period = $5,
            client_name = $6, client_email = $7, client_phone = $8
      WHERE id = $1`,
    [
      accountId,
      details.goLiveDate,
      details.note,
      details.followupAmount,
      details.followupPeriod,
      details.clientName,
      details.clientEmail,
      details.clientPhone,
    ]
  );
  if (!rowCount) return false;
  await addEvent(
    getPool(),
    accountId,
    "dossier_modifie",
    `Mise en ligne : ${details.goLiveDate ?? "non fixée"} ; mensualité de suivi : ${details.followupAmount} FCFA (${details.followupPeriod === "quarter" ? "trimestre" : "mois"}) ; contact du client : ${details.clientName || "—"}, ${details.clientEmail || "pas d'e-mail"}, ${details.clientPhone || "pas de téléphone"}.`
  );
  return true;
}

/** Issues a new private link and invalidates the old one. The token is returned once and never stored. */
export async function regenerateServiceToken(accountId: string): Promise<string | null> {
  await ensureSchema();
  const token = generateServiceToken();
  const { rowCount } = await getPool().query(
    "UPDATE service_accounts SET token_hash = $2, token_created_at = now() WHERE id = $1",
    [accountId, hashServiceToken(token)]
  );
  if (!rowCount) return null;
  await addEvent(getPool(), accountId, "lien_regenere", "Nouveau lien privé créé ; l'ancien ne fonctionne plus.");
  return token;
}

// ---- Payments ---------------------------------------------------------------------------------

export type SubmitPaymentResult =
  | { ok: true; payment: ServicePayment }
  | { ok: false; error: string };

const MAX_PENDING_PER_ACCOUNT = 5;

/** A Mobile Money payment typed by the client on their private page: waits for the admin. */
export async function submitClientMobileMoneyPayment(
  accountId: string,
  input: MobileMoneySubmission
): Promise<SubmitPaymentResult> {
  await ensureSchema();
  const operator = await getOperator(input.operatorId);
  if (!operator || !operator.active) {
    return { ok: false, error: "Cet opérateur n'est pas disponible. Choisissez-en un autre." };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialise submissions of one file (double click, two phones) while we check what is still due.
    await client.query("SELECT 1 FROM service_accounts WHERE id = $1 FOR UPDATE", [accountId]);
    const full = (await loadFullWith(client, accountId)) ?? null;
    if (!full) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Dossier introuvable." };
    }
    const { state } = full;
    if (state.remaining === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ce dossier est soldé : il n'y a plus rien à payer." };
    }
    const pendingCount = full.payments.filter((p) => p.status === "soumis").length;
    if (pendingCount >= MAX_PENDING_PER_ACCOUNT) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Plusieurs paiements attendent déjà d'être confirmés. Patientez, nous les traitons." };
    }
    if (input.amount > state.remaining - state.pending) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error:
          state.remaining - state.pending <= 0
            ? "Un paiement couvrant le reste à payer attend déjà d'être confirmé."
            : `Le montant dépasse ce qu'il reste à payer (${state.remaining - state.pending} FCFA, hors paiements en attente de confirmation).`,
      };
    }
    const id = randomServiceId("SP");
    const { rows } = await client.query<PaymentRow>(
      `INSERT INTO service_payments
         (id, account_id, amount, method, status, source, paid_on, mm_operator, mm_phone, mm_transaction_id)
       VALUES ($1, $2, $3, 'mobile_money', 'soumis', 'client', $4, $5, $6, $7)
       RETURNING ${PAYMENT_COLUMNS}`,
      [id, accountId, input.amount, todayInBenin(), operator.name, input.phone, input.transactionId]
    );
    await addEvent(
      client,
      accountId,
      "paiement_soumis",
      `Paiement ${id} de ${input.amount} FCFA soumis par le client (Mobile Money ${operator.name}).`
    );
    await client.query("COMMIT");
    return { ok: true, payment: rowToPayment(rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: "Cet identifiant de transaction a déjà été enregistré." };
    }
    throw err;
  } finally {
    client.release();
  }
}

async function loadFullWith(client: PoolClient, accountId: string): Promise<ServiceAccountFull | null> {
  const acc = await client.query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM service_accounts WHERE id = $1`,
    [accountId]
  );
  if (!acc.rows[0]) return null;
  const [inst, pays, adjs] = await Promise.all([
    client.query<{ position: number; label: string; due_date: string }>(
      `SELECT position, label, to_char(due_date, 'YYYY-MM-DD') AS due_date
         FROM service_installments WHERE account_id = $1 ORDER BY position`,
      [accountId]
    ),
    client.query<PaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM service_payments WHERE account_id = $1`, [accountId]),
    client.query<{ id: string; created_at: Date; kind: string; amount: number; reason: string }>(
      "SELECT id, created_at, kind, amount, reason FROM service_adjustments WHERE account_id = $1",
      [accountId]
    ),
  ]);
  const account = rowToAccount(acc.rows[0]);
  const installments = inst.rows.map((r) => ({ position: r.position, label: r.label, dueDate: r.due_date }));
  const payments = pays.rows.map(rowToPayment);
  const adjustments: ServiceAdjustment[] = adjs.rows.map((r) => ({
    id: r.id,
    accountId,
    createdAt: r.created_at.toISOString(),
    kind: r.kind as AdjustmentKind,
    amount: r.amount,
    reason: r.reason,
  }));
  return { account, installments, payments, adjustments, state: buildState(account, installments, payments, adjustments) };
}

/** A payment the admin records directly (cash, transfer, Mobile Money received outside the page): confirmed at once. */
export async function recordAdminServicePayment(
  accountId: string,
  input: AdminPaymentInput
): Promise<ServicePayment | null> {
  await ensureSchema();
  const pool = getPool();
  const exists = await pool.query("SELECT 1 FROM service_accounts WHERE id = $1", [accountId]);
  if (!exists.rowCount) return null;
  const id = randomServiceId("SP");
  const { rows } = await pool.query<PaymentRow>(
    `INSERT INTO service_payments (id, account_id, amount, method, status, source, paid_on, reference, confirmed_at)
     VALUES ($1, $2, $3, $4, 'confirme', 'admin', $5, $6, now())
     RETURNING ${PAYMENT_COLUMNS}`,
    [id, accountId, input.amount, input.method, input.paidOn, input.reference]
  );
  await addEvent(
    pool,
    accountId,
    "paiement_enregistre",
    `Paiement ${id} de ${input.amount} FCFA enregistré par l'administrateur (${input.method}, ${input.paidOn}).`
  );
  return rowToPayment(rows[0]);
}

/** Only a payment still waiting ("soumis") can be confirmed or rejected, once. */
export async function confirmServicePayment(paymentId: string): Promise<ServicePayment | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query<PaymentRow>(
    `UPDATE service_payments SET status = 'confirme', confirmed_at = now()
      WHERE id = $1 AND status = 'soumis' RETURNING ${PAYMENT_COLUMNS}`,
    [paymentId]
  );
  if (!rows[0]) return null;
  await addEvent(pool, rows[0].account_id, "paiement_confirme", `Paiement ${paymentId} de ${rows[0].amount} FCFA confirmé.`);
  return rowToPayment(rows[0]);
}

export async function rejectServicePayment(paymentId: string, reason: string): Promise<ServicePayment | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query<PaymentRow>(
    `UPDATE service_payments SET status = 'rejete', rejected_at = now(), reject_reason = $2
      WHERE id = $1 AND status = 'soumis' RETURNING ${PAYMENT_COLUMNS}`,
    [paymentId, reason]
  );
  if (!rows[0]) return null;
  await addEvent(
    pool,
    rows[0].account_id,
    "paiement_rejete",
    `Paiement ${paymentId} de ${rows[0].amount} FCFA rejeté : ${reason || "sans motif"}.`
  );
  return rowToPayment(rows[0]);
}

export async function getServicePayment(paymentId: string): Promise<ServicePayment | null> {
  await ensureSchema();
  const { rows } = await getPool().query<PaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM service_payments WHERE id = $1`, [
    paymentId,
  ]);
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function setServicePaymentEmailResult(paymentId: string, error: string | null): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE service_payments
        SET admin_email_sent_at = CASE WHEN $2::text IS NULL THEN now() ELSE admin_email_sent_at END,
            admin_email_error = $2
      WHERE id = $1`,
    [paymentId, error]
  );
}

// ---- Adjustments ------------------------------------------------------------------------------

export async function addServiceAdjustment(
  accountId: string,
  input: { kind: AdjustmentKind; amount: number; reason: string }
): Promise<ServiceAdjustment | null> {
  await ensureSchema();
  const pool = getPool();
  const exists = await pool.query("SELECT 1 FROM service_accounts WHERE id = $1", [accountId]);
  if (!exists.rowCount) return null;
  const id = randomServiceId("SA");
  const { rows } = await pool.query<{ created_at: Date }>(
    `INSERT INTO service_adjustments (id, account_id, kind, amount, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING created_at`,
    [id, accountId, input.kind, input.amount, input.reason]
  );
  await addEvent(pool, accountId, "ajustement", `${input.kind} de ${input.amount} FCFA : ${input.reason}`);
  return { id, accountId, createdAt: rows[0].created_at.toISOString(), ...input };
}

// ---- Receipts -----------------------------------------------------------------------------------

const RECEIPT_LEASE_MINUTES = 2;

/** Takes the right to send a payment's receipt. False when it was already sent (unless `force`), or is
 *  being sent right now (a double click, two tabs): the same receipt never leaves twice by accident. */
export async function claimServiceReceipt(paymentId: string, force: boolean): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `UPDATE service_payments SET receipt_claimed_at = now()
      WHERE id = $1 AND status = 'confirme'
        AND ($2::boolean OR receipt_sent_at IS NULL)
        AND (receipt_claimed_at IS NULL OR receipt_claimed_at < now() - ($3::int * interval '1 minute'))`,
    [paymentId, force, RECEIPT_LEASE_MINUTES]
  );
  return (rowCount ?? 0) > 0;
}

export async function markServiceReceiptSent(paymentId: string, accountId: string, to: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    "UPDATE service_payments SET receipt_sent_at = now(), receipt_error = NULL, receipt_claimed_at = NULL WHERE id = $1",
    [paymentId]
  );
  await addEvent(pool, accountId, "recu_envoye", `Reçu du paiement ${paymentId} envoyé à ${to}.`);
}

export async function markServiceReceiptFailed(paymentId: string, accountId: string, error: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE service_payments SET receipt_error = $2, receipt_claimed_at = NULL WHERE id = $1", [
    paymentId,
    error.slice(0, 300),
  ]);
  await addEvent(pool, accountId, "recu_echec", `Reçu du paiement ${paymentId} non envoyé : ${error.slice(0, 200)}`);
}
