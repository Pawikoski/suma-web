import { z } from 'zod';

const nullableString = z.string().nullable();
const optionalNullableString = z.string().nullable().optional();
const decimalLike = z.union([z.string(), z.number()]).transform(String);
const positiveDecimalLike = decimalLike.refine(value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}, 'Wartość musi być większa od zera.');
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
  liability_kind: optionalNullableString.default(null),
  credit_limit: decimalLike.nullable().optional().default(null),
  statement_day: z.number().nullable().optional().default(null),
  payment_due_day: z.number().nullable().optional().default(null),
  liability_principal: decimalLike.nullable().optional().default(null),
  liability_monthly_payment: decimalLike.nullable().optional().default(null),
  payment_account_id: optionalNullableString.default(null),
  credit_card_last4: optionalNullableString.default(null),
  credit_card_theme: optionalNullableString.default(null),
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

export const syncTransactionPhotoSchema = z.object({
  ...syncBaseFields,
  transaction_id: optionalNullableString.default(null),
  mime_type: z.string().optional().default('image/jpeg'),
  content_hash: z.string().optional().default(''),
  image_base64: optionalNullableString.default(null),
});

export const syncRecurringCategorySplitSchema = z.object({
  category_id: z.string(),
  amount: decimalLike,
});

export const syncRecurringTransactionSchema = z.object({
  ...syncBaseFields,
  from_account_id: optionalNullableString.default(null),
  to_account_id: optionalNullableString.default(null),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  total_amount: decimalLike.nullable().optional().default(null),
  account_currency: z.string().optional().default('PLN'),
  transaction_amount: decimalLike.nullable().optional().default(null),
  transaction_currency: optionalNullableString.default(null),
  exchange_rate: z.number().nullable().optional().default(null),
  to_account_amount: decimalLike.nullable().optional().default(null),
  to_account_currency: optionalNullableString.default(null),
  notes: optionalNullableString.default(null),
  location_lat: z.number().nullable().optional().default(null),
  location_lng: z.number().nullable().optional().default(null),
  location_name: optionalNullableString.default(null),
  location_address: optionalNullableString.default(null),
  count_in_summary: z.boolean().optional().default(true),
  summary_amount: decimalLike.nullable().optional().default(null),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval_value: z.number().int().positive().optional().default(1),
  start_date: z.string(),
  end_date: optionalNullableString.default(null),
  last_generated_date: optionalNullableString.default(null),
  skipped_occurrence_dates: z.array(z.string()).optional().default([]),
  category_splits: z.array(syncRecurringCategorySplitSchema).optional().default([]),
  recurring_category: z.enum(['FIXED_ACCOUNT_FEE', 'SUBSCRIPTION', 'BILL', 'INSURANCE', 'LOAN', 'SAVINGS', 'RENTAL', 'OTHER']).optional().default('OTHER'),
  recurring_category_label: optionalNullableString.default(null),
  is_active: z.boolean().optional().default(true),
});

export const syncCategoryBudgetSchema = z.object({
  ...syncBaseFields,
  category_id: z.string().nullable(),
  type: z.enum(['EXPENSE_BUDGET', 'INCOME_BUDGET']),
  budget_amount: decimalLike,
});

export const syncAccountBudgetSchema = z.object({
  ...syncBaseFields,
  account_id: optionalNullableString.default(null),
  budget_amount: decimalLike,
});

export const syncOverallBudgetSchema = z.object({
  ...syncBaseFields,
  budget_amount: decimalLike,
});

export const syncAccountBudgetOverrideSchema = z.object({
  ...syncBaseFields,
  account_id: optionalNullableString.default(null),
  year_month: z.string(),
  budget_amount: decimalLike,
});

export const syncOverallBudgetOverrideSchema = z.object({
  ...syncBaseFields,
  year_month: z.string(),
  budget_amount: decimalLike,
});

export const syncInvestmentHoldingSchema = z.object({
  ...syncBaseFields,
  account_id: optionalNullableString.default(null),
  symbol: z.string(),
  name: z.string(),
  investment_type: z.enum(['STOCK', 'ETF', 'CRYPTO', 'PRECIOUS_METAL']),
  quantity: z.number().nonnegative(),
  unit_price: positiveDecimalLike,
  currency: z.string(),
  purchase_currency: z.string(),
  notes: z.string().optional().default(''),
});

export const syncInvestmentTransactionSchema = z.object({
  ...syncBaseFields,
  holding_id: optionalNullableString.default(null),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  unit_price: positiveDecimalLike,
  currency: z.string(),
  date: z.string(),
  notes: z.string().optional().default(''),
});

export const syncAccountInterestSchema = z.object({
  ...syncBaseFields,
  account_id: optionalNullableString.default(null),
  annual_rate_percent: z.number(),
  base_amount: decimalLike.nullable().optional().default(null),
  start_date: z.string(),
  end_date: z.string(),
  tax_rate_percent: z.number().optional().default(19),
  after_maturity_action: z.enum(['DISABLE', 'TRANSFER']).optional().default('DISABLE'),
  target_account_id: optionalNullableString.default(null),
  is_active: z.boolean().optional().default(true),
  interest_category_id: optionalNullableString.default(null),
  monthly_payment: decimalLike.nullable().optional().default(null),
  original_loan_amount: decimalLike.nullable().optional().default(null),
});

export const syncSettlementSchema = z.object({
  ...syncBaseFields,
  direction: z.enum(['LENT', 'BORROWED']),
  account_id: optionalNullableString.default(null),
  transaction_id: optionalNullableString.default(null),
  counterparty_name: z.string(),
  counterparty_email: optionalNullableString.default(null),
  total_amount: decimalLike,
  currency: z.string().optional().default('PLN'),
  note: optionalNullableString.default(null),
  due_date: optionalNullableString.default(null),
  reminder_days_before: z.string().optional().default('1'),
  status: z.enum(['ACTIVE', 'SETTLED']).optional().default('ACTIVE'),
});

export const syncSettlementPaymentSchema = z.object({
  ...syncBaseFields,
  settlement_id: optionalNullableString.default(null),
  account_id: optionalNullableString.default(null),
  transaction_id: optionalNullableString.default(null),
  amount: decimalLike,
  paid_at: z.string(),
  note: optionalNullableString.default(null),
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
    account_budgets: z.array(syncAccountBudgetSchema).optional().default([]),
    categories: z.array(syncCategorySchema),
    recurring_transactions: z.array(syncRecurringTransactionSchema).optional().default([]),
    transactions: z.array(syncTransactionSchema),
    transaction_splits: z.array(syncTransactionSplitSchema),
    transaction_photos: z.array(syncTransactionPhotoSchema).optional().default([]),
    category_budgets: z.array(syncCategoryBudgetSchema),
    overall_budgets: z.array(syncOverallBudgetSchema),
    account_budget_overrides: z.array(syncAccountBudgetOverrideSchema).optional().default([]),
    overall_budget_overrides: z.array(syncOverallBudgetOverrideSchema).optional().default([]),
    investment_holdings: z.array(syncInvestmentHoldingSchema).optional().default([]),
    investment_transactions: z.array(syncInvestmentTransactionSchema).optional().default([]),
    account_interest: z.array(syncAccountInterestSchema).optional().default([]),
    settlements: z.array(syncSettlementSchema).optional().default([]),
    settlement_payments: z.array(syncSettlementPaymentSchema).optional().default([]),
  }),
});

export type ParsedSyncResponse = z.infer<typeof syncResponseSchema>;

export function parseSyncResponse(input: unknown): ParsedSyncResponse {
  return syncResponseSchema.parse(input);
}
