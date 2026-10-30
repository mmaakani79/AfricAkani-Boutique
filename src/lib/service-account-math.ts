// Payment file ("dossier de paiement") of a client for a service AkaGest builds
// for them (e.g. a shop). Pure maths, no database, no React: unit-tested, and the
// single place that decides "paid", "remaining", "next due date" and the status.
//
// All amounts are whole FCFA. Nothing is ever deleted: a discount, a correction or a
// refund is one more line (an "adjustment"), and the figures below are always
// recomputed from the full history.
//
//   adjustedTotal = total − reductions ± corrections
//   paid          = confirmed payments − refunds
//   remaining     = adjustedTotal − paid           (never shown below 0: see `overpaid`)
//   tranches      = (adjustedTotal − deposit) split in N equal tranches; the last one
//                   takes the rounding. The deposit is the first payment and is
//                   deducted from the total.
//   payments are applied in order: deposit first, then the tranches in date order.

export const DEFAULT_DEPOSIT = 5000;
export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 4;

export type PaymentKind = "deposit" | "installment" | "other";
export type PaymentStatus = "soumis" | "confirme" | "rejete";
export type AdjustmentKind = "reduction" | "correction" | "remboursement";

export interface MathPayment {
  amount: number;
  status: PaymentStatus;
}

/** `reduction` and `remboursement` are positive amounts; `correction` is signed
 *  (+ adds to what the client owes, − lowers it). */
export interface MathAdjustment {
  kind: AdjustmentKind;
  amount: number;
}

export interface MathInstallment {
  position: number;
  label: string;
  /** YYYY-MM-DD */
  dueDate: string;
}

export type ScheduleStatus = "paye" | "partiel" | "a_payer" | "en_retard";
export type AccountStatus = "en_cours" | "solde" | "en_retard";

export interface ScheduleLine {
  /** 0 = the deposit, 1..N = the tranches. */
  position: number;
  kind: "deposit" | "installment";
  label: string;
  /** YYYY-MM-DD, null for the deposit (due on signing, never "late" by itself). */
  dueDate: string | null;
  amount: number;
  paid: number;
  status: ScheduleStatus;
}

export interface NextDue {
  position: number;
  kind: "deposit" | "installment";
  label: string;
  dueDate: string | null;
  /** What is still missing on that line. */
  amount: number;
}

export interface AccountState {
  adjustedTotal: number;
  reductions: number;
  corrections: number;
  refunds: number;
  /** Confirmed payments minus refunds. */
  paid: number;
  /** Submitted by the client, not confirmed yet: not counted in `paid`. */
  pending: number;
  remaining: number;
  overpaid: number;
  schedule: ScheduleLine[];
  next: NextDue | null;
  status: AccountStatus;
}

export function isValidInstallmentCount(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_INSTALLMENTS && n <= MAX_INSTALLMENTS;
}

/** Splits `amount` into `parts` whole amounts that add up exactly; the last one takes the rounding. */
export function splitAmount(amount: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error("parts must be a positive integer");
  const total = Math.max(0, Math.round(amount));
  const base = Math.floor(total / parts);
  const out = Array.from({ length: parts }, () => base);
  out[parts - 1] += total - base * parts;
  return out;
}

export function sumConfirmed(payments: MathPayment[]): number {
  return payments.filter((p) => p.status === "confirme").reduce((s, p) => s + p.amount, 0);
}

/** Today's date (YYYY-MM-DD) in Benin (UTC+1, no daylight saving). */
export function todayInBenin(now: number = Date.now()): string {
  return new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function computeAccountState(input: {
  total: number;
  deposit: number;
  installments: MathInstallment[];
  payments: MathPayment[];
  adjustments: MathAdjustment[];
  /** YYYY-MM-DD, "today" in Benin. */
  today: string;
}): AccountState {
  const { total, deposit, today } = input;
  const installments = [...input.installments].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.position - b.position
  );

  let reductions = 0;
  let corrections = 0;
  let refunds = 0;
  for (const adj of input.adjustments) {
    if (adj.kind === "reduction") reductions += adj.amount;
    else if (adj.kind === "correction") corrections += adj.amount;
    else refunds += adj.amount;
  }
  const adjustedTotal = total - reductions + corrections;
  const confirmed = sumConfirmed(input.payments);
  const pending = input.payments
    .filter((p) => p.status === "soumis")
    .reduce((s, p) => s + p.amount, 0);
  const paid = confirmed - refunds;
  const remaining = Math.max(0, adjustedTotal - paid);
  const overpaid = Math.max(0, paid - adjustedTotal);

  // Deposit line, then the tranches: the total left after the deposit is split between them.
  const depositAmount = Math.min(Math.max(0, deposit), Math.max(0, adjustedTotal));
  const toSpread = Math.max(0, adjustedTotal - depositAmount);
  const amounts = installments.length > 0 ? splitAmount(toSpread, installments.length) : [];

  const lines: Omit<ScheduleLine, "paid" | "status">[] = [
    { position: 0, kind: "deposit", label: "Acompte", dueDate: null, amount: depositAmount },
    ...installments.map((inst, i) => ({
      position: i + 1,
      kind: "installment" as const,
      label: inst.label,
      dueDate: inst.dueDate,
      amount: amounts[i],
    })),
  ];

  // Payments are applied in order, so a tranche is "covered" when the cumulative amount paid reaches it.
  let credit = Math.max(0, paid);
  const schedule: ScheduleLine[] = lines.map((line) => {
    const covered = Math.min(credit, line.amount);
    credit -= covered;
    let status: ScheduleStatus;
    if (line.amount === 0 || covered >= line.amount) status = "paye";
    else if (line.dueDate !== null && line.dueDate < today) status = "en_retard";
    else status = covered > 0 ? "partiel" : "a_payer";
    return { ...line, paid: covered, status };
  });

  const nextLine = schedule.find((l) => l.status !== "paye") ?? null;
  const next: NextDue | null = nextLine
    ? {
        position: nextLine.position,
        kind: nextLine.kind,
        label: nextLine.label,
        dueDate: nextLine.dueDate,
        amount: nextLine.amount - nextLine.paid,
      }
    : null;

  let status: AccountStatus;
  if (remaining === 0) status = "solde";
  else if (schedule.some((l) => l.status === "en_retard")) status = "en_retard";
  else status = "en_cours";

  return {
    adjustedTotal,
    reductions,
    corrections,
    refunds,
    paid,
    pending,
    remaining,
    overpaid,
    schedule,
    next,
    status,
  };
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  en_cours: "En cours",
  solde: "Soldé",
  en_retard: "En retard",
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  paye: "Payé",
  partiel: "Partiel",
  a_payer: "À payer",
  en_retard: "En retard",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  soumis: "En attente de confirmation",
  confirme: "Confirmé",
  rejete: "Rejeté",
};

export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  reduction: "Réduction",
  correction: "Correction",
  remboursement: "Remboursement",
};

/** Validates the amount of an adjustment according to its kind; returns a French error or null. */
export function adjustmentAmountError(kind: AdjustmentKind, amount: number): string | null {
  if (!Number.isInteger(amount)) return "Le montant doit être un nombre entier de FCFA.";
  if (amount === 0) return "Le montant ne peut pas être nul.";
  if (kind !== "correction" && amount < 0) {
    return kind === "reduction"
      ? "Une réduction s'entre en nombre positif (elle est retranchée du total)."
      : "Un remboursement s'entre en nombre positif.";
  }
  if (Math.abs(amount) > 100_000_000) return "Montant trop élevé.";
  return null;
}
