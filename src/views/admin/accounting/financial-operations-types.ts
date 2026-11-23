type FinancialEntity = { _id: string };

export type FinancialAccount = FinancialEntity & { code: string; name: string; type: string };
export type FinancialTrialBalanceRow = {
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
};
export type FinancialJournal = FinancialEntity & {
  number: string | number;
  date: string;
  description: string;
  status: string;
};
export type FinancialExpense = FinancialEntity & {
  date: string;
  title: string;
  category: string;
  amount: number;
  status: string;
};
export type FinancialSettlement = FinancialEntity & {
  provider: string;
  reference: string;
  netAmount: number;
  status: string;
};
export type FinancialCashAccount = FinancialEntity & { name: string; kind: string };
export type FinancialPeriod = FinancialEntity & { name: string; status: string };
export type FinancialTrend = {
  _id: { month: string; code: string };
  credit?: number;
  debit?: number;
};

export type FinancialData = {
  accounts: FinancialAccount[];
  trialBalance: FinancialTrialBalanceRow[];
  profitAndLoss: { revenue: number; expense: number; netProfit: number };
  balanceSheet: { assets: number; liabilities: number; equity: number; retainedProfit: number };
  accountTypeSummary: Record<string, number>;
  settlementSummary: Record<string, number>;
  cashFlow: {
    inflow: number;
    outflow: number;
    net: number;
    rows: {
      accountCode: string;
      accountName: string;
      inflow: number;
      outflow: number;
      net: number;
    }[];
  };
  gatewaySubledger: {
    provider: string;
    branchId: string;
    collected: number;
    settled: number;
    inTransit: number;
    transactions: number;
  }[];
  expenses: FinancialExpense[];
  settlements: FinancialSettlement[];
  cashAccounts: FinancialCashAccount[];
  periods: FinancialPeriod[];
  journals: FinancialJournal[];
  trends: FinancialTrend[];
  alerts: string[];
  issues: {
    _id: string;
    type: string;
    severity: string;
    entityId: string;
    message?: string;
    status: 'open' | 'reviewing' | 'ignored' | 'resolved';
    assignedTo?: string;
    note?: string;
  }[];
  receivables: number;
  payables: number;
};
