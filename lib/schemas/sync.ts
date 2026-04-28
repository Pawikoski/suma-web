import { z } from 'zod';

const nullableString = z.string().nullable();
const syncBaseFields = {
  id: z.string(),
  updated_at: z.string(),
  deleted_at: nullableString,
  version: z.number(),
};

export const syncAccountSchema = z.object({
  ...syncBaseFields,
  name: z.string(),
  type: z.string(),
  category: z.string(),
  balance: z.string(),
  currency: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  is_active: z.boolean(),
  include_in_net_worth: z.boolean(),
  icon_name: z.string(),
  icon_bg: z.string(),
  icon_color: z.string(),
  notes: nullableString,
});

export const syncCategorySchema = z.object({
  ...syncBaseFields,
  name: z.string(),
  types: z.array(z.string()),
  icon_name: z.string(),
  icon_bg: z.string(),
  icon_color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  is_system: z.boolean(),
});

export const syncTransactionSchema = z.object({
  ...syncBaseFields,
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  total_amount: z.string(),
  from_account_id: z.string(),
  to_account_id: nullableString,
  account_currency: z.string(),
  date_time: z.string(),
  notes: nullableString,
  location_name: nullableString,
  location_address: nullableString,
  count_in_summary: z.boolean(),
});

export const syncTransactionSplitSchema = z.object({
  ...syncBaseFields,
  transaction_id: z.string(),
  category_id: z.string(),
  amount: z.string(),
  name: z.string(),
});

export const syncCategoryBudgetSchema = z.object({
  ...syncBaseFields,
  category_id: z.string(),
  type: z.enum(['EXPENSE_BUDGET', 'INCOME_BUDGET']),
  budget_amount: z.string(),
});

export const syncOverallBudgetSchema = z.object({
  ...syncBaseFields,
  budget_amount: z.string(),
});

export const syncResponseSchema = z.object({
  request_id: z.string(),
  new_sync_token: z.union([z.string(), z.number()]).transform(String),
  server_changes: z.object({
    accounts: z.array(syncAccountSchema),
    categories: z.array(syncCategorySchema),
    transactions: z.array(syncTransactionSchema),
    transaction_splits: z.array(syncTransactionSplitSchema),
    category_budgets: z.array(syncCategoryBudgetSchema),
    overall_budgets: z.array(syncOverallBudgetSchema),
  }),
});

export type ParsedSyncResponse = z.infer<typeof syncResponseSchema>;

export function parseSyncResponse(input: unknown): ParsedSyncResponse {
  return syncResponseSchema.parse(input);
}
