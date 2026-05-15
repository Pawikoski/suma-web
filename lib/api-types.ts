import { ParsedSyncResponse } from './schemas/sync';

export interface SyncAccount {
  id: string;
  name: string;
  type: string;
  category: string;
  balance: string;
  currency: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  include_in_net_worth: boolean;
  icon_name: string | null;
  icon_bg: string | null;
  icon_color: string | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncAppliedItem {
  id: string;
  status: string;
  server_version?: number;
  server_updated_at?: string | null;
  reason?: string;
}

export interface SyncErrorItem {
  model: string;
  id?: string;
  error: string;
  detail?: string;
}

export interface SyncConflictItem {
  model: string;
  id: string;
  resolution: string;
  server_record?: unknown;
  client_record?: unknown;
}

export interface SyncCategory {
  id: string;
  name: string;
  types: string[];
  icon_name: string;
  icon_bg: string;
  icon_color: string;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  parent_category_id: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncTransaction {
  id: string;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  total_amount: string;
  from_account_id: string;
  to_account_id: string | null;
  account_currency: string;
  transaction_amount: string | null;
  transaction_currency: string | null;
  exchange_rate: number | null;
  to_account_amount: string | null;
  to_account_currency: string | null;
  recurring_transaction_id: string | null;
  date_time: string;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  location_address: string | null;
  is_from_receipt: boolean;
  is_from_notification_parser: boolean;
  review_status: string | null;
  parser_notification_key: string | null;
  count_in_summary: boolean;
  summary_amount: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncTransactionSplit {
  id: string;
  transaction_id: string | null;
  category_id: string | null;
  amount: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncRecurringCategorySplit {
  category_id: string;
  amount: string;
}

export interface SyncRecurringTransaction {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  total_amount: string | null;
  account_currency: string;
  transaction_amount: string | null;
  transaction_currency: string | null;
  exchange_rate: number | null;
  to_account_amount: string | null;
  to_account_currency: string | null;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  location_address: string | null;
  count_in_summary: boolean;
  summary_amount: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval_value: number;
  start_date: string;
  end_date: string | null;
  last_generated_date: string | null;
  skipped_occurrence_dates: string[];
  category_splits: SyncRecurringCategorySplit[];
  recurring_category: 'FIXED_ACCOUNT_FEE' | 'SUBSCRIPTION' | 'BILL' | 'INSURANCE' | 'LOAN' | 'SAVINGS' | 'RENTAL' | 'OTHER';
  recurring_category_label: string | null;
  is_active: boolean;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncInvestmentHolding {
  id: string;
  account_id: string | null;
  symbol: string;
  name: string;
  investment_type: 'STOCK' | 'ETF' | 'CRYPTO' | 'PRECIOUS_METAL';
  quantity: number;
  unit_price: string;
  currency: string;
  purchase_currency: string;
  notes: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncInvestmentTransaction {
  id: string;
  holding_id: string | null;
  type: 'BUY' | 'SELL';
  quantity: number;
  unit_price: string;
  currency: string;
  date: string;
  notes: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncAccountInterest {
  id: string;
  account_id: string | null;
  annual_rate_percent: number;
  base_amount: string | null;
  start_date: string;
  end_date: string;
  tax_rate_percent: number;
  after_maturity_action: 'DISABLE' | 'TRANSFER';
  target_account_id: string | null;
  is_active: boolean;
  interest_category_id: string | null;
  monthly_payment: string | null;
  original_loan_amount: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncCategoryBudget {
  id: string;
  category_id: string | null;
  type: 'EXPENSE_BUDGET' | 'INCOME_BUDGET';
  budget_amount: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncOverallBudget {
  id: string;
  budget_amount: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncSettlement {
  id: string;
  direction: 'LENT' | 'BORROWED';
  account_id: string | null;
  transaction_id: string | null;
  counterparty_name: string;
  counterparty_email: string | null;
  total_amount: string;
  currency: string;
  note: string | null;
  due_date: string | null;
  reminder_days_before: string;
  status: 'ACTIVE' | 'SETTLED';
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncSettlementPayment {
  id: string;
  settlement_id: string | null;
  account_id: string | null;
  transaction_id: string | null;
  amount: string;
  paid_at: string;
  note: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncServerChanges {
  accounts: SyncAccount[];
  account_budgets?: unknown[];
  categories: SyncCategory[];
  recurring_transactions?: SyncRecurringTransaction[];
  transactions: SyncTransaction[];
  transaction_splits: SyncTransactionSplit[];
  transaction_photos?: unknown[];
  category_budgets: SyncCategoryBudget[];
  overall_budgets: SyncOverallBudget[];
  account_budget_overrides?: unknown[];
  overall_budget_overrides?: unknown[];
  investment_holdings?: SyncInvestmentHolding[];
  investment_transactions?: SyncInvestmentTransaction[];
  account_interest?: SyncAccountInterest[];
  settlements?: SyncSettlement[];
  settlement_payments?: SyncSettlementPayment[];
}

export type SyncResponse = ParsedSyncResponse;
