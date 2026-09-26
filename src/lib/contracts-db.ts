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

export interface SignedContract extends SignedContractInput {
  createdAt: string;
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
}

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
  };
}

export async function createSignedContract(
  input: SignedContractInput
): Promise<SignedContract> {
  await ensureSchema();
  const { rows } = await getPool().query<SignedContractRow>(
    `INSERT INTO signed_contracts
      (id, client_name, client_email, client_phone, company_name, services, project_description, budget, timeline, notes, contract_text_snapshot, signature_data_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
  return rowToSignedContract(rows[0]);
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
