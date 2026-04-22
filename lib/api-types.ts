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
  icon_name: string;
  icon_bg: string;
  icon_color: string;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  version: number;
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
  date_time: string;
  notes: string | null;
  location_name: string | null;
  location_address: string | null;
  count_in_summary: boolean;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncTransactionSplit {
  id: string;
  transaction_id: string;
  category_id: string;
  amount: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SyncCategoryBudget {
  id: string;
  category_id: string;
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

export interface SyncServerChanges {
  accounts: SyncAccount[];
  categories: SyncCategory[];
  transactions: SyncTransaction[];
  transaction_splits: SyncTransactionSplit[];
  category_budgets: SyncCategoryBudget[];
  overall_budgets: SyncOverallBudget[];
}

export interface SyncResponse {
  request_id: string;
  new_sync_token: string;
  server_changes: SyncServerChanges;
}
