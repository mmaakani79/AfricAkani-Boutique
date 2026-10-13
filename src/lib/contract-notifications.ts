// Wires the contract e-mails to the real database, PDF generator and Resend.
// The rules themselves live in contract-email-delivery.ts.

import {
  claimContractEmail,
  getSignedContractById,
  markContractEmailFailed,
  markContractEmailSent,
  type ContractEmailTarget,
} from "./contracts-db";
import { generateContractPdf } from "./contract-pdf";
import {
  CONTRACT_EMAIL_TARGETS,
  deliverContractEmails,
  type ContractEmailSenders,
  type ContractEmailStore,
  type DeliveryResult,
} from "./contract-email-delivery";
import { sendContractAdminEmail, sendContractClientEmail } from "./email";

const store: ContractEmailStore = {
  getContract: getSignedContractById,
  claim: claimContractEmail,
  markSent: markContractEmailSent,
  markFailed: markContractEmailFailed,
};

const senders: ContractEmailSenders = {
  admin: (contract) => sendContractAdminEmail(contract),
  client: async (contract) => sendContractClientEmail(contract, await generateContractPdf(contract)),
};

/** Right after a signature: both e-mails, never forced (so never twice). Never throws. */
export function notifyContractSigned(contractId: string): Promise<DeliveryResult> {
  return deliverContractEmails({ contractId, targets: CONTRACT_EMAIL_TARGETS, store, senders });
}

/** From the admin: resend one e-mail (or both). `force` only after the admin confirmed re-sending an e-mail already sent. */
export function resendContractEmails(
  contractId: string,
  targets: readonly ContractEmailTarget[],
  force: boolean
): Promise<DeliveryResult> {
  return deliverContractEmails({ contractId, targets, force, store, senders });
}
