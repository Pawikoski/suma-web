export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  name: string;
  type: string;
  rawType: string;
  balance: number;
  currency: string;
  color: string;
  color2: string;
  icon: string;
  category: string;
  sortOrder: number;
  includeInNetWorth: boolean;
  notes: string | null;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface Category {
  id: string;
  name: string;
  types: string[];
  icon: string;
  bg: string;
  color: string;
  spent: number;
  budget: number | null;
  budgetId: string | null;
  budgetVersion: number | null;
  txCount: number;
  parentCategoryId: string | null;
  isSystem: boolean;
  sortOrder: number;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface Transaction {
  id: string;
  date: string;
  dateTime: string;
  cat: string;
  catIcon: string;
  catBg: string;
  catColor: string;
  categoryId: string | null;
  desc: string;
  acc: string;
  accountId: string;
  toAccountId: string | null;
  toAccountName: string | null;
  currency: string;
  amount: number;
  rawAmount: number;
  type: TransactionType;
  loc?: string;
  countInSummary: boolean;
  splitIds: string[];
  splits: TransactionSplitSummary[];
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface TransactionSplitSummary {
  id: string;
  categoryId: string | null;
  amount: number;
}

export interface OverallBudget {
  id: string;
  amount: number;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringCategory =
  | 'FIXED_ACCOUNT_FEE'
  | 'SUBSCRIPTION'
  | 'BILL'
  | 'INSURANCE'
  | 'LOAN'
  | 'SAVINGS'
  | 'RENTAL'
  | 'OTHER';

export interface RecurringSplitSummary {
  categoryId: string;
  amount: number;
}

export interface RecurringTransaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  rawType: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number | null;
  currency: string;
  fromAccountId: string | null;
  fromAccountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  notes: string;
  locationName: string | null;
  frequency: RecurringFrequency;
  intervalValue: number;
  startDate: string;
  endDate: string | null;
  lastGeneratedDate: string | null;
  skippedOccurrenceDates: string[];
  categorySplits: RecurringSplitSummary[];
  recurringCategory: RecurringCategory;
  recurringCategoryLabel: string | null;
  isActive: boolean;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export type InvestmentType = 'STOCK' | 'ETF' | 'CRYPTO' | 'PRECIOUS_METAL';
export type InvestmentTransactionType = 'BUY' | 'SELL';

export interface InvestmentTransaction {
  id: string;
  holdingId: string | null;
  type: InvestmentTransactionType;
  quantity: number;
  unitPrice: number;
  currency: string;
  date: string;
  notes: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface InvestmentHolding {
  id: string;
  accountId: string | null;
  accountName: string | null;
  symbol: string;
  name: string;
  investmentType: InvestmentType;
  quantity: number;
  unitPrice: number;
  value: number;
  currency: string;
  purchaseCurrency: string;
  notes: string;
  transactions: InvestmentTransaction[];
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface AccountInterest {
  id: string;
  accountId: string | null;
  accountName: string | null;
  annualRatePercent: number;
  baseAmount: number | null;
  effectiveBaseAmount: number;
  startDate: string;
  endDate: string;
  taxRatePercent: number;
  afterMaturityAction: 'DISABLE' | 'TRANSFER';
  targetAccountId: string | null;
  targetAccountName: string | null;
  isActive: boolean;
  interestCategoryId: string | null;
  monthlyPayment: number | null;
  originalLoanAmount: number | null;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export type SettlementDirection = 'LENT' | 'BORROWED';
export type SettlementStatus = 'ACTIVE' | 'SETTLED';

export interface SettlementPayment {
  id: string;
  settlementId: string | null;
  accountId: string | null;
  accountName: string | null;
  transactionId: string | null;
  amount: number;
  paidAt: string;
  note: string | null;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface Settlement {
  id: string;
  direction: SettlementDirection;
  accountId: string | null;
  accountName: string | null;
  transactionId: string | null;
  counterpartyName: string;
  counterpartyEmail: string | null;
  totalAmount: number;
  repaidAmount: number;
  remainingAmount: number;
  currency: string;
  note: string | null;
  dueDate: string | null;
  reminderDaysBefore: string;
  status: SettlementStatus;
  isOverdue: boolean;
  payments: SettlementPayment[];
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}
