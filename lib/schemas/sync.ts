import { z } from 'zod';

const nullableString = z.string().nullable();
const optionalNullableString = z.string().nullable().optional();
const decimalLike = z.union([z.string(), z.number()]).transform(String);
const syncBaseFields = {
  id: z.string(),
  updated_at: z.string(),
  deleted_at: optionalNullableString.default(null),
  version: z.number(),
};

export const syncAccountSchema = z.object({
  ...syncBaseFields,
  name: z.string(),
  type: z.string(),
  category: z.string(),
  balance: decimalLike,
  currency: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  is_active: z.boolean(),
  include_in_net_worth: z.boolean(),
  icon_name: z.string().nullable().optional().default(''),
  icon_bg: z.string().nullable().optional().default('#FFFFFF'),
  icon_color: z.string().nullable().optional().default('#000000'),
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
  parent_category_id: optionalNullableString.default(null),
});

export const syncTransactionSchema = z.object({
  ...syncBaseFields,
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  total_amount: decimalLike,
  from_account_id: z.string(),
  to_account_id: nullableString,
  account_currency: z.string(),
  transaction_amount: decimalLike.nullable().optional().default(null),
  transaction_currency: optionalNullableString.default(null),
  exchange_rate: z.number().nullable().optional().default(null),
  to_account_amount: decimalLike.nullable().optional().default(null),
  to_account_currency: optionalNullableString.default(null),
  recurring_transaction_id: optionalNullableString.default(null),
  date_time: z.string(),
  notes: nullableString,
  location_lat: z.number().nullable().optional().default(null),
  location_lng: z.number().nullable().optional().default(null),
  location_name: nullableString,
  location_address: nullableString,
  is_from_receipt: z.boolean().optional().default(false),
  is_from_notification_parser: z.boolean().optional().default(false),
  review_status: optionalNullableString.default(null),
  parser_notification_key: optionalNullableString.default(null),
  count_in_summary: z.boolean(),
  summary_amount: decimalLike.nullable().optional().default(null),
});

export const syncTransactionSplitSchema = z.object({
  ...syncBaseFields,
  transaction_id: z.string().nullable(),
  category_id: z.string().nullable(),
  amount: decimalLike,
  name: z.string().optional().default(''),
  quantity: z.number().optional().default(1),
  unit: z.string().optional().default('pcs'),
  unit_price: decimalLike.nullable().optional().default(null),
});

export const syncCategoryBudgetSchema = z.object({
  ...syncBaseFields,
  category_id: z.string().nullable(),
  type: z.enum(['EXPENSE_BUDGET', 'INCOME_BUDGET']),
  budget_amount: decimalLike,
});

export const syncOverallBudgetSchema = z.object({
  ...syncBaseFields,
  budget_amount: decimalLike,
});

const syncAppliedItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  server_version: z.number().optional(),
  server_updated_at: z.string().nullable().optional(),
  reason: z.string().optional(),
});

const syncAppliedSchema = z.record(z.string(), z.array(syncAppliedItemSchema));

const syncErrorSchema = z.object({
  model: z.string(),
  id: z.string().optional(),
  error: z.string(),
  detail: z.string().optional(),
});

const syncConflictSchema = z.object({
  model: z.string(),
  id: z.string(),
  resolution: z.string(),
  server_record: z.unknown().optional(),
  client_record: z.unknown().optional(),
});

export const syncResponseSchema = z.object({
  request_id: z.string(),
  new_sync_token: z.union([z.string(), z.number()]).transform(String),
  applied: syncAppliedSchema.optional(),
  conflicts: z.array(syncConflictSchema).optional().default([]),
  errors: z.array(syncErrorSchema).optional().default([]),
  server_changes: z.object({
    accounts: z.array(syncAccountSchema),
    account_budgets: z.array(z.unknown()).optional().default([]),
    categories: z.array(syncCategorySchema),
    recurring_transactions: z.array(z.unknown()).optional().default([]),
    transactions: z.array(syncTransactionSchema),
    transaction_splits: z.array(syncTransactionSplitSchema),
    transaction_photos: z.array(z.unknown()).optional().default([]),
    category_budgets: z.array(syncCategoryBudgetSchema),
    overall_budgets: z.array(syncOverallBudgetSchema),
    account_budget_overrides: z.array(z.unknown()).optional().default([]),
    overall_budget_overrides: z.array(z.unknown()).optional().default([]),
    investment_holdings: z.array(z.unknown()).optional().default([]),
    investment_transactions: z.array(z.unknown()).optional().default([]),
    account_interest: z.array(z.unknown()).optional().default([]),
    settlements: z.array(z.unknown()).optional().default([]),
    settlement_payments: z.array(z.unknown()).optional().default([]),
  }),
});

export type ParsedSyncResponse = z.infer<typeof syncResponseSchema>;

export function parseSyncResponse(input: unknown): ParsedSyncResponse {
  return syncResponseSchema.parse(input);
}
