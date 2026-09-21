export interface MobileMoneyOperator {
  id: string;
  name: string;
  merchantNumber: string;
  active: boolean;
}

export interface MobileMoneyConfig {
  beneficiaryName: string;
  operators: MobileMoneyOperator[];
}
