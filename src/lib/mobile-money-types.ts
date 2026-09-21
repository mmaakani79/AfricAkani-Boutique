export interface MobileMoneyOperator {
  id: string;
  name: string;
  merchantNumber: string;
  /** Name that appears on the customer's phone when they send the transfer — may differ from `name`. */
  displayName: string;
  active: boolean;
}

export interface MobileMoneyConfig {
  beneficiaryName: string;
  operators: MobileMoneyOperator[];
}
