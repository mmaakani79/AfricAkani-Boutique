import { ensureSchema, getPool } from "./db";

export async function getContractText(): Promise<string> {
  await ensureSchema();
  const { rows } = await getPool().query<{ contract_text: string }>(
    "SELECT contract_text FROM contract_settings WHERE id = 1"
  );
  return rows[0]?.contract_text ?? "";
}

export async function setContractText(text: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO contract_settings (id, contract_text)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET contract_text = EXCLUDED.contract_text`,
    [text]
  );
}

export interface SignedContractInput {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  services: string[];
  projectDescription: string;
  budget: string;
  timeline: string;
  notes: string;
  contractTextSnapshot: string;
  signatureDataUrl: string;
}

/** Where one of the two e-mails stands. Dates are ISO strings (safe to pass to client components). */
export interface ContractEmailState {
  sentAt: string | null;
  /** Why the last attempt failed; null when it never failed or later succeeded. */
  error: string | null;
  /** Set while a send is in flight (a short lease, see claimContractEmail). */
  claimedAt: string | null;
}

export type ContractEmailTarget = "admin" | "client";

export interface SignedContract extends SignedContractInput {
  createdAt: string;
  emails: Record<ContractEmailTarget, ContractEmailState>;
}

interface SignedContractRow {
  id: string;
  created_at: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  company_name: string | null;
  services: string[];
  project_description: string;
  budget: string | null;
  timeline: string | null;
  notes: string | null;
  contract_text_snapshot: string;
  signature_data_url: string;
  admin_email_sent_at: string | Date | null;
  admin_email_error: string | null;
  admin_email_claimed_at: string | Date | null;
  client_email_sent_at: string | Date | null;
  client_email_error: string | null;
  client_email_claimed_at: string | Date | null;
}

const toIso = (value: string | Date | null): string | null =>
  value === null ? null : new Date(value).toISOString();

function rowToSignedContract(row: SignedContractRow): SignedContract {
  return {
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    companyName: row.company_name ?? "",
    services: row.services,
    projectDescription: row.project_description,
    budget: row.budget ?? "",
    timeline: row.timeline ?? "",
    notes: row.notes ?? "",
    contractTextSnapshot: row.contract_text_snapshot,
    signatureDataUrl: row.signature_data_url,
    emails: {
      admin: {
        sentAt: toIso(row.admin_email_sent_at),
        error: row.admin_email_error,
        claimedAt: toIso(row.admin_email_claimed_at),
      },
      client: {
        sentAt: toIso(row.client_email_sent_at),
        error: row.client_email_error,
        claimedAt: toIso(row.client_email_claimed_at),
      },
    },
  };
}

export interface CreateSignedContractResult {
  contract: SignedContract;
  /** False when a contract with this reference already existed (double click, reload, retry): nothing was written. */
  created: boolean;
}

/** Idempotent on the contract reference: submitting the same reference twice
 *  stores one contract and tells the caller it was not newly created. */
export async function createSignedContract(
  input: SignedContractInput
): Promise<CreateSignedContractResult> {
  await ensureSchema();
  const { rows } = await getPool().query<SignedContractRow>(
    `INSERT INTO signed_contracts
      (id, client_name, client_email, client_phone, company_name, services, project_description, budget, timeline, notes, contract_text_snapshot, signature_data_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      input.id,
      input.clientName,
      input.clientEmail,
      input.clientPhone,
      input.companyName || null,
      input.services,
      input.projectDescription,
      input.budget || null,
      input.timeline || null,
      input.notes || null,
      input.contractTextSnapshot,
      input.signatureDataUrl,
    ]
  );
  if (rows[0]) return { contract: rowToSignedContract(rows[0]), created: true };

  const existing = await getSignedContractById(input.id);
  if (!existing) throw new Error(`Contrat ${input.id} introuvable après conflit.`);
  return { contract: existing, created: false };
}

export async function getAllSignedContracts(): Promise<SignedContract[]> {
  await ensureSchema();
  const { rows } = await getPool().query<SignedContractRow>(
    "SELECT * FROM signed_contracts ORDER BY created_at DESC"
  );
  return rows.map(rowToSignedContract);
}

export async function getSignedContractById(
  id: string
): Promise<SignedContract | null> {
  await ensureSchema();
  const { rows } = await getPool().query<SignedContractRow>(
    "SELECT * FROM signed_contracts WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToSignedContract(rows[0]) : null;
}

export async function deleteSignedContract(id: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    "DELETE FROM signed_contracts WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// ---- E-mail delivery bookkeeping ---------------------------------------------

// Column names come from this fixed map, never from user input.
const EMAIL_COLUMNS: Record<ContractEmailTarget, { sent: string; error: string; claimed: string }> = {
  admin: { sent: "admin_email_sent_at", error: "admin_email_error", claimed: "admin_email_claimed_at" },
  client: { sent: "client_email_sent_at", error: "client_email_error", claimed: "client_email_claimed_at" },
};

/** How long a send may be "in flight" before another attempt may take over (a crashed request). */
export const CONTRACT_EMAIL_LEASE_SECONDS = 120;

/** Atomically takes the right to send one of the two e-mails. Returns false if
 *  it was already sent (unless `force`) or another request is sending it right
 *  now — in which case the caller must NOT send. */
export async function claimContractEmail(
  id: string,
  target: ContractEmailTarget,
  force: boolean
): Promise<boolean> {
  await ensureSchema();
  const c = EMAIL_COLUMNS[target];
  const { rowCount } = await getPool().query(
    `UPDATE signed_contracts SET ${c.claimed} = now()
      WHERE id = $1
        AND (${c.claimed} IS NULL OR ${c.claimed} < now() - make_interval(secs => $3))
        AND ($2::boolean OR ${c.sent} IS NULL)`,
    [id, force, CONTRACT_EMAIL_LEASE_SECONDS]
  );
  return (rowCount ?? 0) > 0;
}

export async function markContractEmailSent(id: string, target: ContractEmailTarget): Promise<void> {
  const c = EMAIL_COLUMNS[target];
  await getPool().query(
    `UPDATE signed_contracts SET ${c.sent} = now(), ${c.error} = NULL, ${c.claimed} = NULL WHERE id = $1`,
    [id]
  );
}

export async function markContractEmailFailed(
  id: string,
  target: ContractEmailTarget,
  message: string
): Promise<void> {
  const c = EMAIL_COLUMNS[target];
  await getPool().query(
    `UPDATE signed_contracts SET ${c.error} = $2, ${c.claimed} = NULL WHERE id = $1`,
    [id, message]
  );
}
