// Sending the two contract e-mails safely. Pure orchestration: the database
// and the mail provider are passed in, so every rule below is unit-tested
// without either.
//
// Rules:
//  - a failure never throws and never undoes the signature: it is recorded on
//    the contract (visible in the admin) and can be resent;
//  - an e-mail is sent at most once per contract unless an admin forces a
//    resend: the right to send is claimed atomically first, so a double click,
//    a reload or two servers racing can't send it twice;
//  - the two e-mails are independent: one failing doesn't stop the other.

import { withTimeout } from "./with-timeout";
import type { ContractEmailState, ContractEmailTarget, SignedContract } from "./contracts-db";

export const CONTRACT_EMAIL_TARGETS: readonly ContractEmailTarget[] = ["admin", "client"];

/** Longest we make the signing client wait for the mail provider. */
export const CONTRACT_EMAIL_TIMEOUT_MS = 8000;

export type DeliveryOutcome = "sent" | "failed" | "skipped";
export type DeliveryResult = Record<ContractEmailTarget, DeliveryOutcome | "not_requested">;

export interface ContractEmailStore {
  getContract(id: string): Promise<SignedContract | null>;
  /** true = this caller now owns the right to send. */
  claim(id: string, target: ContractEmailTarget, force: boolean): Promise<boolean>;
  markSent(id: string, target: ContractEmailTarget): Promise<void>;
  markFailed(id: string, target: ContractEmailTarget, message: string): Promise<void>;
}

export type ContractEmailSenders = Record<ContractEmailTarget, (contract: SignedContract) => Promise<void>>;

/** A readable, secret-free reason, short enough to show in the admin. */
export function safeEmailError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/\bre_[A-Za-z0-9_]{8,}\b/g, "[clé masquée]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function deliverContractEmails(params: {
  contractId: string;
  targets: readonly ContractEmailTarget[];
  /** Admin pressing « Renvoyer » on an e-mail already sent. Automatic sends never force. */
  force?: boolean;
  store: ContractEmailStore;
  senders: ContractEmailSenders;
  timeoutMs?: number;
}): Promise<DeliveryResult> {
  const { contractId, targets, store, senders } = params;
  const force = params.force ?? false;
  const timeoutMs = params.timeoutMs ?? CONTRACT_EMAIL_TIMEOUT_MS;
  const result: DeliveryResult = { admin: "not_requested", client: "not_requested" };

  const sendOne = async (target: ContractEmailTarget): Promise<void> => {
    try {
      if (!(await store.claim(contractId, target, force))) {
        result[target] = "skipped";
        return;
      }
    } catch {
      // Can't even reach the database: nothing was claimed, nothing was sent.
      result[target] = "failed";
      return;
    }

    try {
      const contract = await store.getContract(contractId);
      if (!contract) throw new Error("Contrat introuvable.");
      try {
        await withTimeout(senders[target](contract), timeoutMs);
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new Error(
            "Délai dépassé : l'envoi a peut-être abouti. Vérifiez la boîte d'envoi avant de renvoyer."
          );
        }
        throw err;
      }
      await store.markSent(contractId, target);
      result[target] = "sent";
    } catch (err) {
      result[target] = "failed";
      try {
        await store.markFailed(contractId, target, safeEmailError(err));
      } catch (markErr) {
        console.error(`[email] Contrat ${contractId} (${target}) : échec non enregistré — ${safeEmailError(markErr)}`);
      }
      console.error(`[email] Contrat ${contractId} (${target}) : ${safeEmailError(err)}`);
    }
  };

  await Promise.all(targets.map(sendOne));
  return result;
}

// ---- What the admin sees ------------------------------------------------------

export type ContractEmailStatus =
  | { kind: "sent"; at: string }
  | { kind: "failed"; error: string }
  | { kind: "sending" }
  | { kind: "not_sent" };

/** Matches CONTRACT_EMAIL_LEASE_SECONDS in contracts-db (not imported: this file stays free of the database driver). */
const SENDING_WINDOW_MS = 120_000;

export function contractEmailStatus(state: ContractEmailState, now: number = Date.now()): ContractEmailStatus {
  const sending = state.claimedAt !== null && now - new Date(state.claimedAt).getTime() < SENDING_WINDOW_MS;
  if (sending) return { kind: "sending" };
  if (state.error) return { kind: "failed", error: state.error };
  if (state.sentAt) return { kind: "sent", at: state.sentAt };
  return { kind: "not_sent" };
}

/** True when the admin must act: an e-mail failed. (A contract signed before this
 *  feature simply shows "Non envoyé" without raising an alarm.) */
export function contractHasEmailFailure(contract: Pick<SignedContract, "emails">, now: number = Date.now()): boolean {
  return CONTRACT_EMAIL_TARGETS.some((t) => contractEmailStatus(contract.emails[t], now).kind === "failed");
}
