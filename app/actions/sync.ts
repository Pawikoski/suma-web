'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fetchSync, postSyncChanges } from '@/lib/api';
import {
  SyncAccount,
  SyncAccountBudget,
  SyncAccountBudgetOverride,
  SyncCategory,
  SyncCategoryBudget,
  SyncAccountInterest,
  SyncInvestmentHolding,
  SyncInvestmentTransaction,
  SyncOverallBudget,
  SyncOverallBudgetOverride,
  SyncRecurringTransaction,
  SyncServerChanges,
  SyncSettlement,
  SyncSettlementPayment,
  SyncTransaction,
  SyncTransactionSplit,
} from '@/lib/api-types';
import { inferImportedCategoryHierarchy } from '@/lib/import-category-hierarchy';
import { normalizeCategoryIconName } from '@/lib/category-icons';
import { importAnalysisSchema } from '@/lib/schemas/import-analysis';
import { SyncRequestError } from '@/lib/sync-errors';
import { importPreflight } from '@/lib/import-preflight';
import { submissionEntityId } from '@/lib/submission-id';
import { LOCKED_CATEGORY_MESSAGE } from '@/lib/category-lock';

export type ActionResult =
  | { ok: true; id?: string; message?: string; found?: number; total?: number }
  | { ok: false; message: string; outcomeUnknown?: boolean };

const transactionInputSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.coerce.number().positive('Podaj kwotę większą od zera.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.string().min(1),
  toAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional().default(''),
});

const transactionCreateInputSchema = transactionInputSchema.extend({ submissionId: z.uuid(), submittedAt: z.iso.datetime() });

const transactionUpdateInputSchema = transactionInputSchema.extend({
  id: z.string().min(1),
  confirmDestinationBalanceChange: z.boolean().optional().default(false),
  expectedVersion: z.number().int().positive(),
});

const settlementInputSchema = z.object({
  direction: z.enum(['LENT', 'BORROWED']),
  amount: z.coerce.number().refine(Number.isFinite, 'Podaj poprawną kwotę.').min(0.01, 'Podaj kwotę co najmniej 0,01.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  accountId: z.string().min(1),
  counterpartyName: z.string().trim().min(1, 'Podaj osobę rozliczenia.').max(120),
  counterpartyEmail: z.string().trim().email('Podaj poprawny email.').or(z.literal('')).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional().default(1),
});

const settlementPaymentInputSchema = z.object({
  settlementId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.coerce.number().refine(Number.isFinite, 'Podaj poprawną kwotę.').min(0.01, 'Podaj kwotę co najmniej 0,01.'),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional().default(''),
});

const settleSettlementInputSchema = z.object({
  settlementId: z.string().min(1),
  accountId: z.string().min(1),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const recurringInputSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: z.coerce.number().positive('Podaj kwotę większą od zera.'),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  intervalValue: z.coerce.number().int().positive().max(99).optional().default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
  recurringCategory: z.enum(['FIXED_ACCOUNT_FEE', 'SUBSCRIPTION', 'BILL', 'INSURANCE', 'LOAN', 'SAVINGS', 'RENTAL', 'OTHER']).optional().default('OTHER'),
  recurringCategoryLabel: z.string().trim().max(120).optional().default(''),
});

const accountInputSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę konta.').max(120),
  type: z.enum(['CASH', 'BANK', 'PROPERTY', 'INVESTMENT']),
  category: z.enum(['BASIC', 'SAVINGS', 'LIABILITY']).optional().default('BASIC'),
  balance: z.coerce.number(),
  currency: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()),
  includeInNetWorth: z.coerce.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional().default(''),
  liabilityKind: z.enum(['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'INSTALLMENT_LOAN', 'OTHER']).nullable().optional(),
  creditLimit: z.coerce.number().nonnegative().nullable().optional(),
  statementDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  liabilityPrincipal: z.coerce.number().nonnegative().nullable().optional(),
  liabilityMonthlyPayment: z.coerce.number().nonnegative().nullable().optional(),
  paymentAccountId: z.string().nullable().optional(),
  creditCardLast4: z.string().trim().regex(/^\d{0,4}$/).nullable().optional(),
  creditCardTheme: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

const accountUpdateInputSchema = accountInputSchema.extend({
  id: z.string().min(1),
});

const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę kategorii.').max(120),
  types: z.array(z.enum(['EXPENSE', 'INCOME'])).min(1, 'Wybierz typ kategorii.'),
  iconName: z.string().trim().min(1).max(120)
    .refine(name => normalizeCategoryIconName(name) !== null, 'Wybierz ikonę z listy.')
    .transform(name => normalizeCategoryIconName(name)!)
    .optional().default('Category'),
  iconBg: z.string().trim().min(4).max(16).optional().default('#F3F4F6'),
  iconColor: z.string().trim().min(4).max(16).optional().default('#6B7280'),
  parentCategoryId: z.string().nullable().optional(),
});

const categoryUpdateInputSchema = categoryInputSchema.extend({
  id: z.string().min(1),
});

const investmentHoldingInputSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().trim().min(1, 'Podaj symbol.').max(32).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Podaj nazwę.').max(160),
  investmentType: z.enum(['STOCK', 'ETF', 'CRYPTO', 'PRECIOUS_METAL']),
  quantity: z.coerce.number().positive('Podaj ilość większą od zera.'),
  unitPrice: z.coerce.number().positive('Podaj cenę większą od zera.'),
  currency: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()),
  notes: z.string().trim().max(500).optional().default(''),
});

const investmentHoldingUpdateInputSchema = investmentHoldingInputSchema.extend({
  id: z.string().min(1),
});

const investmentTradeInputSchema = z.object({
  holdingId: z.string().min(1),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.coerce.number().positive('Podaj ilość większą od zera.'),
  unitPrice: z.coerce.number().positive('Podaj cenę większą od zera.'),
  notes: z.string().trim().max(500).optional().default(''),
});

const accountInterestInputSchema = z.object({
  accountId: z.string().min(1),
  annualRatePercent: z.coerce.number().min(0).max(100),
  baseAmount: z.coerce.number().positive().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxRatePercent: z.coerce.number().min(0).max(100).optional().default(19),
  afterMaturityAction: z.enum(['DISABLE', 'TRANSFER']).optional().default('DISABLE'),
  targetAccountId: z.string().nullable().optional(),
  interestCategoryId: z.string().nullable().optional(),
  monthlyPayment: z.coerce.number().positive().nullable().optional(),
  originalLoanAmount: z.coerce.number().positive().nullable().optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: 'Data końca musi być późniejsza niż data startu.',
  path: ['endDate'],
});

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const money = (value: number) => roundMoney(value).toFixed(2);
const nullableMoney = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? money(parsed) : null;
};
const nowIso = () => new Date().toISOString();
const dateToNoonUtc = (date: string) => `${date}T12:00:00.000Z`;

function cloneAccountWithBalance(account: SyncAccount, balance: number, updatedAt: string) {
  return {
    id: account.id,
    parent_id: account.parent_id,
    name: account.name,
    type: account.type,
    category: account.category,
    balance: money(balance),
    balance_anchor: account.balance_anchor,
    currency: account.currency,
    sort_order: account.sort_order,
    is_default: account.is_default,
    is_active: account.is_active,
    include_in_net_worth: account.include_in_net_worth,
    icon_name: account.icon_name ?? '',
    icon_bg: account.icon_bg ?? '#FFFFFF',
    icon_color: account.icon_color ?? '#000000',
    notes: account.notes,
    liability_kind: account.liability_kind,
    credit_limit: account.credit_limit,
    statement_day: account.statement_day,
    payment_due_day: account.payment_due_day,
    liability_principal: account.liability_principal,
    liability_monthly_payment: account.liability_monthly_payment,
    payment_account_id: account.payment_account_id,
    credit_card_last4: account.credit_card_last4,
    credit_card_theme: account.credit_card_theme,
    updated_at: updatedAt,
    deleted_at: null,
    version: account.version,
  };
}

function accountBalanceDelta(
  account: SyncAccount,
  type: SyncTransaction['type'],
  role: 'FROM' | 'TO',
  amount: number
) {
  const normalizedAmount = Math.abs(amount);
  const baseDelta = type === 'INCOME'
    ? (role === 'FROM' ? normalizedAmount : 0)
    : type === 'EXPENSE'
      ? (role === 'FROM' ? -normalizedAmount : 0)
      : (role === 'FROM' ? -normalizedAmount : normalizedAmount);
  return account.category === 'LIABILITY' ? -baseDelta : baseDelta;
}

function balanceAfterTransaction(
  account: SyncAccount,
  balance: number,
  type: SyncTransaction['type'],
  role: 'FROM' | 'TO',
  amount: number,
  multiplier = 1
) {
  return balance + accountBalanceDelta(account, type, role, amount) * multiplier;
}

function accountAppearance(type: 'CASH' | 'BANK' | 'PROPERTY' | 'INVESTMENT') {
  switch (type) {
    case 'CASH':
      return { icon_name: 'Wallet', icon_bg: '#FEF3C7', icon_color: '#F59E0B' };
    case 'PROPERTY':
      return { icon_name: 'Home', icon_bg: '#D1FAE5', icon_color: '#10B981' };
    case 'INVESTMENT':
      return { icon_name: 'ShowChart', icon_bg: '#EDE9FE', icon_color: '#8B5CF6' };
    case 'BANK':
      return { icon_name: 'AccountBalance', icon_bg: '#DBEAFE', icon_color: '#3B82F6' };
  }
}

function normalizeAccountCategory(type: 'CASH' | 'BANK' | 'PROPERTY' | 'INVESTMENT', category: 'BASIC' | 'SAVINGS' | 'LIABILITY') {
  if (type === 'INVESTMENT') return 'BASIC';
  if (type === 'PROPERTY' && category === 'SAVINGS') return 'BASIC';
  if (type === 'CASH' && category === 'SAVINGS') return 'BASIC';
  return category;
}

function validateAccountLiabilityInput(
  data: z.infer<typeof accountInputSchema>,
  existingId: string | null,
  changes: SyncServerChanges
) {
  const category = normalizeAccountCategory(data.type, data.category);
  if (!Number.isFinite(data.balance)) return 'Podaj poprawne saldo konta.';
  if (category !== 'LIABILITY') return null;
  if (data.balance < 0) return 'Saldo zobowiązania wpisz jako wartość dodatnią.';

  const kind = data.liabilityKind ?? 'OTHER';
  if (kind !== 'CREDIT_CARD') return null;
  const paymentAccountId = data.paymentAccountId ?? null;
  if (!paymentAccountId) return null;
  if (paymentAccountId === existingId) return 'Karta kredytowa nie może spłacać samej siebie.';
  const paymentAccount = changes.accounts.find(account => account.id === paymentAccountId && !account.deleted_at && account.is_active);
  if (!paymentAccount) return 'Wybierz aktywne konto do spłat.';
  if (paymentAccount.category === 'LIABILITY') return 'Konto do spłat musi być kontem aktywów.';
  if (paymentAccount.currency !== data.currency) return 'Konto do spłat musi mieć tę samą walutę.';
  return null;
}

function accountPayload(
  data: z.infer<typeof accountInputSchema>,
  existing: SyncAccount | undefined,
  sortOrder: number,
  updatedAt: string
) {
  const appearance = existing
    ? {
        icon_name: existing.icon_name ?? '',
        icon_bg: existing.icon_bg ?? '#FFFFFF',
        icon_color: existing.icon_color ?? '#000000',
      }
    : accountAppearance(data.type);
  const category = normalizeAccountCategory(data.type, data.category);
  const liabilityKind = category === 'LIABILITY' ? data.liabilityKind ?? existing?.liability_kind ?? 'OTHER' : null;
  const isCreditCard = liabilityKind === 'CREDIT_CARD';

  return {
    id: existing?.id ?? crypto.randomUUID(),
    parent_id: existing?.parent_id,
    name: data.name,
    type: data.type,
    category,
    balance: money(data.balance),
    balance_anchor: existing?.balance_anchor != null
      ? money(Number(existing.balance_anchor) + data.balance - Number(existing.balance))
      : undefined,
    currency: data.currency,
    sort_order: existing?.sort_order ?? sortOrder,
    is_default: existing?.is_default ?? false,
    is_active: existing?.is_active ?? true,
    include_in_net_worth: data.includeInNetWorth,
    icon_name: appearance.icon_name,
    icon_bg: appearance.icon_bg,
    icon_color: appearance.icon_color,
    notes: data.notes || null,
    liability_kind: liabilityKind,
    credit_limit: isCreditCard ? nullableMoney(data.creditLimit ?? existing?.credit_limit ?? null) : null,
    statement_day: isCreditCard ? data.statementDay ?? existing?.statement_day ?? null : null,
    payment_due_day: isCreditCard ? data.paymentDueDay ?? existing?.payment_due_day ?? null : null,
    liability_principal: category === 'LIABILITY' && !isCreditCard ? nullableMoney(data.liabilityPrincipal ?? existing?.liability_principal ?? null) : null,
    liability_monthly_payment: category === 'LIABILITY' && !isCreditCard ? nullableMoney(data.liabilityMonthlyPayment ?? existing?.liability_monthly_payment ?? null) : null,
    payment_account_id: isCreditCard ? data.paymentAccountId ?? existing?.payment_account_id ?? null : null,
    credit_card_last4: isCreditCard ? (data.creditCardLast4 ?? existing?.credit_card_last4 ?? null) || null : null,
    credit_card_theme: isCreditCard ? data.creditCardTheme ?? existing?.credit_card_theme ?? '#4F46E5' : null,
    updated_at: updatedAt,
    deleted_at: null,
    version: existing?.version ?? 1,
  };
}

function categoryPayload(
  data: z.infer<typeof categoryInputSchema>,
  existing: SyncCategory | undefined,
  sortOrder: number,
  updatedAt: string
) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: data.name,
    types: Array.from(new Set(data.types)),
    icon_name: data.iconName,
    icon_bg: data.iconBg,
    icon_color: data.iconColor,
    sort_order: existing?.sort_order ?? sortOrder,
    is_default: existing?.is_default ?? false,
    is_system: existing?.is_system ?? false,
    is_locked: existing?.is_locked ?? false,
    // Renaming a default category freezes its name: the key would make apps translate it again.
    default_key: existing && existing.name === data.name ? existing.default_key : '',
    essentiality: existing?.essentiality,
    classification_source: existing?.classification_source,
    parent_category_id: data.parentCategoryId || null,
    updated_at: updatedAt,
    deleted_at: null,
    version: existing?.version ?? 1,
  };
}

function cloneCategoryForDeletion(category: SyncCategory, updatedAt: string) {
  return {
    id: category.id,
    name: `${category.name}_deleted_${Date.now()}`,
    types: category.types,
    icon_name: category.icon_name,
    icon_bg: category.icon_bg,
    icon_color: category.icon_color,
    sort_order: category.sort_order,
    is_default: category.is_default,
    is_system: category.is_system,
    is_locked: category.is_locked,
    default_key: category.default_key,
    parent_category_id: category.parent_category_id,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: category.version,
  };
}

function ledgerTransactionPayload({
  id,
  type,
  amount,
  account,
  date,
  note,
  updatedAt,
}: {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  account: SyncAccount;
  date: string;
  note: string;
  updatedAt: string;
}) {
  return {
    id,
    type,
    total_amount: money(amount),
    from_account_id: account.id,
    to_account_id: null,
    account_currency: account.currency,
    transaction_amount: money(amount),
    transaction_currency: account.currency,
    exchange_rate: 1,
    to_account_amount: null,
    to_account_currency: null,
    recurring_transaction_id: null,
    date_time: dateToNoonUtc(date),
    notes: note,
    location_lat: null,
    location_lng: null,
    location_name: null,
    location_address: null,
    is_from_receipt: false,
    is_from_notification_parser: false,
    review_status: null,
    parser_notification_key: null,
    count_in_summary: false,
    summary_amount: null,
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  };
}

function settlementStatusPayload(settlement: SyncSettlement, status: 'ACTIVE' | 'SETTLED', updatedAt: string) {
  return {
    id: settlement.id,
    direction: settlement.direction,
    account_id: settlement.account_id,
    transaction_id: settlement.transaction_id,
    counterparty_name: settlement.counterparty_name,
    counterparty_email: settlement.counterparty_email,
    total_amount: settlement.total_amount,
    currency: settlement.currency,
    note: settlement.note,
    due_date: settlement.due_date,
    reminder_days_before: settlement.reminder_days_before,
    status,
    updated_at: updatedAt,
    deleted_at: null,
    version: settlement.version,
  };
}

function revalidateFinancePaths() {
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/investments');
  revalidatePath('/settlements');
  revalidatePath('/reports');
}

function syncFailureMessage(errors: unknown[], conflicts: unknown[]) {
  if (errors.length > 0) return 'API odrzuciło zmianę. Sprawdź limity konta lub dane formularza.';
  if (conflicts.some(conflict => !conflict || typeof conflict !== 'object' || !('resolution' in conflict) || conflict.resolution !== 'client_wins')) return 'Zmiana ma konflikt z nowszymi danymi z serwera. Odśwież i spróbuj ponownie.';
  return null;
}

function isActiveInvestmentAssetAccount(account: SyncAccount | undefined): account is SyncAccount {
  return Boolean(account && !account.deleted_at && account.is_active && account.type === 'INVESTMENT' && account.category !== 'LIABILITY');
}

async function getServerChanges(): Promise<(SyncServerChanges & { syncResetGeneration: number }) | null> {
  const sync = await fetchSync();
  return sync ? { ...sync.server_changes, syncResetGeneration: sync.sync_reset_generation } : null;
}

async function executeCreateTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane transakcji.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const transactionId = submissionEntityId(data.submissionId, 'transaction:0');
  if (changes.transactions.some(row => row.id === transactionId)) return { ok: true, id: transactionId, message: 'Transakcja została wcześniej zapisana.' };
  const fromAccount = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!fromAccount) return { ok: false, message: 'Wybierz aktywne konto.' };

  const toAccount = data.type === 'transfer'
    ? changes.accounts.find(a => a.id === data.toAccountId && !a.deleted_at && a.is_active)
    : null;
  if (data.type === 'transfer' && !toAccount) return { ok: false, message: 'Wybierz konto docelowe.' };
  if (data.type === 'transfer' && toAccount?.id === fromAccount.id) {
    return { ok: false, message: 'Konta transferu muszą być różne.' };
  }

  if (toAccount && toAccount.currency !== fromAccount.currency) return { ok: false, message: 'Transfer między różnymi walutami utwórz w aplikacji mobilnej.' };

  const category = data.type === 'transfer'
    ? null
    : changes.categories.find(c => c.id === data.categoryId && !c.deleted_at);
  if (data.type !== 'transfer' && !category) return { ok: false, message: 'Wybierz kategorię.' };
  if (category?.is_locked) return { ok: false, message: LOCKED_CATEGORY_MESSAGE };

  const updatedAt = data.submittedAt;
  const splitId = submissionEntityId(data.submissionId, 'split:0');
  const amount = data.amount;
  const transactionType = data.type.toUpperCase() as SyncTransaction['type'];
  const sync = await postSyncChanges({
    transactions: [
      {
        id: transactionId,
        type: transactionType,
        total_amount: money(amount),
        from_account_id: fromAccount.id,
        to_account_id: toAccount?.id ?? null,
        account_currency: fromAccount.currency,
        transaction_amount: money(amount),
        transaction_currency: fromAccount.currency,
        exchange_rate: 1,
        to_account_amount: toAccount ? money(amount) : null,
        to_account_currency: toAccount?.currency ?? null,
        recurring_transaction_id: null,
        date_time: dateToNoonUtc(data.date),
        notes: data.note || null,
        location_lat: null,
        location_lng: null,
        location_name: null,
        location_address: null,
        is_from_receipt: false,
        is_from_notification_parser: false,
        review_status: null,
        parser_notification_key: null,
        count_in_summary: true,
        summary_amount: null,
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
    transaction_splits: category
      ? [
          {
            id: splitId,
            transaction_id: transactionId,
            category_id: category.id,
            amount: money(amount),
            name: data.note || '',
            quantity: 1,
            unit: 'pcs',
            unit_price: money(amount),
            updated_at: updatedAt,
            deleted_at: null,
            version: 1,
          },
        ]
      : [],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zsynchronizować transakcji.';
  if (failure) return { ok: false, message: failure, ...(sync && sync.errors.length === 0 ? { outcomeUnknown: true } : {}) };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/budget');
  revalidatePath('/categories');
  return { ok: true, id: transactionId, message: 'Transakcja została zapisana.' };
}

function cloneTransactionForDeletion(transaction: SyncTransaction, updatedAt: string) {
  return { ...transaction, updated_at: updatedAt, deleted_at: updatedAt };
}

function cloneSplitForDeletion(split: SyncTransactionSplit, updatedAt: string) {
  return {
    id: split.id,
    transaction_id: split.transaction_id,
    category_id: split.category_id,
    amount: split.amount,
    name: split.name,
    quantity: split.quantity,
    unit: split.unit,
    unit_price: split.unit_price,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: split.version,
  };
}

function cloneSettlementForDeletion(settlement: SyncSettlement, updatedAt: string) {
  return {
    id: settlement.id,
    direction: settlement.direction,
    account_id: settlement.account_id,
    transaction_id: settlement.transaction_id,
    counterparty_name: settlement.counterparty_name,
    counterparty_email: settlement.counterparty_email,
    total_amount: settlement.total_amount,
    currency: settlement.currency,
    note: settlement.note,
    due_date: settlement.due_date,
    reminder_days_before: settlement.reminder_days_before,
    status: settlement.status,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: settlement.version,
  };
}

function cloneSettlementPaymentForDeletion(payment: SyncSettlementPayment, updatedAt: string) {
  return {
    id: payment.id,
    settlement_id: payment.settlement_id,
    account_id: payment.account_id,
    transaction_id: payment.transaction_id,
    amount: payment.amount,
    paid_at: payment.paid_at,
    note: payment.note,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: payment.version,
  };
}

function cloneRecurringForDeletion(recurring: SyncRecurringTransaction, updatedAt: string) {
  return {
    id: recurring.id,
    from_account_id: recurring.from_account_id,
    to_account_id: recurring.to_account_id,
    type: recurring.type,
    total_amount: recurring.total_amount,
    account_currency: recurring.account_currency,
    transaction_amount: recurring.transaction_amount,
    transaction_currency: recurring.transaction_currency,
    exchange_rate: recurring.exchange_rate,
    to_account_amount: recurring.to_account_amount,
    to_account_currency: recurring.to_account_currency,
    notes: recurring.notes,
    location_lat: recurring.location_lat,
    location_lng: recurring.location_lng,
    location_name: recurring.location_name,
    location_address: recurring.location_address,
    count_in_summary: recurring.count_in_summary,
    summary_amount: recurring.summary_amount,
    frequency: recurring.frequency,
    interval_value: recurring.interval_value,
    start_date: recurring.start_date,
    end_date: recurring.end_date,
    last_generated_date: recurring.last_generated_date,
    skipped_occurrence_dates: recurring.skipped_occurrence_dates,
    category_splits: recurring.category_splits,
    recurring_category: recurring.recurring_category,
    recurring_category_label: recurring.recurring_category_label,
    is_active: recurring.is_active,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: recurring.version,
  };
}

function investmentHoldingPayload(
  data: z.infer<typeof investmentHoldingInputSchema>,
  existing: SyncInvestmentHolding | undefined,
  updatedAt: string,
  quantity = data.quantity,
  unitPrice = data.unitPrice
) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    account_id: data.accountId,
    symbol: data.symbol,
    name: data.name,
    investment_type: data.investmentType,
    quantity,
    unit_price: money(unitPrice),
    currency: data.currency,
    purchase_currency: data.currency,
    notes: data.notes || null,
    updated_at: updatedAt,
    deleted_at: null,
    version: existing?.version ?? 1,
  };
}

function cloneInvestmentHoldingForDeletion(holding: SyncInvestmentHolding, updatedAt: string) {
  return {
    id: holding.id,
    account_id: holding.account_id,
    symbol: holding.symbol,
    name: holding.name,
    investment_type: holding.investment_type,
    quantity: holding.quantity,
    unit_price: holding.unit_price,
    currency: holding.currency,
    purchase_currency: holding.purchase_currency,
    notes: holding.notes,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: holding.version,
  };
}

function cloneInvestmentTransactionForDeletion(transaction: SyncInvestmentTransaction, updatedAt: string) {
  return {
    id: transaction.id,
    holding_id: transaction.holding_id,
    type: transaction.type,
    quantity: transaction.quantity,
    unit_price: transaction.unit_price,
    currency: transaction.currency,
    date: transaction.date,
    notes: transaction.notes,
    updated_at: updatedAt,
    deleted_at: updatedAt,
    version: transaction.version,
  };
}

function accountInterestPayload(
  data: z.infer<typeof accountInterestInputSchema>,
  existing: SyncAccountInterest | undefined,
  updatedAt: string,
  deletedAt: string | null = null
) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    account_id: data.accountId,
    annual_rate_percent: data.annualRatePercent,
    base_amount: data.baseAmount === null || data.baseAmount === undefined ? null : money(data.baseAmount),
    start_date: dateToNoonUtc(data.startDate),
    end_date: dateToNoonUtc(data.endDate),
    tax_rate_percent: data.taxRatePercent,
    after_maturity_action: data.afterMaturityAction,
    target_account_id: data.afterMaturityAction === 'TRANSFER' ? data.targetAccountId || null : null,
    is_active: deletedAt === null,
    interest_category_id: data.interestCategoryId || null,
    monthly_payment: data.monthlyPayment === null || data.monthlyPayment === undefined ? null : money(data.monthlyPayment),
    original_loan_amount: data.originalLoanAmount === null || data.originalLoanAmount === undefined ? null : money(data.originalLoanAmount),
    updated_at: updatedAt,
    deleted_at: deletedAt,
    version: existing?.version ?? 1,
  };
}

function cloneTransactionForUpdate(
  transaction: SyncTransaction,
  data: z.infer<typeof transactionInputSchema>,
  fromAccount: SyncAccount,
  toAccount: SyncAccount | null,
  updatedAt: string
) {
  const amount = money(data.amount);
  const sameMoney = transaction.type === data.type.toUpperCase() &&
    transaction.from_account_id === fromAccount.id && transaction.to_account_id === (toAccount?.id ?? null) &&
    Number(transaction.total_amount) === data.amount;

  const resolvingDestination = transaction.account_link_state === 'MISSING_DESTINATION' && data.type === 'transfer' && toAccount !== null;
  const preservesMissingDestination = transaction.account_link_state === 'MISSING_DESTINATION' && data.type === 'transfer' && toAccount === null;
  return {
    ...transaction,
    id: transaction.id,
    type: data.type.toUpperCase(),
    account_link_state: preservesMissingDestination ? 'MISSING_DESTINATION' : 'COMPLETE',
    missing_destination_reason: preservesMissingDestination ? transaction.missing_destination_reason : null,
    total_amount: sameMoney ? transaction.total_amount : amount,
    from_account_id: fromAccount.id,
    to_account_id: toAccount?.id ?? null,
    account_currency: fromAccount.currency,
    transaction_amount: sameMoney || resolvingDestination ? transaction.transaction_amount : amount,
    transaction_currency: sameMoney || resolvingDestination ? transaction.transaction_currency : fromAccount.currency,
    exchange_rate: sameMoney || resolvingDestination ? transaction.exchange_rate : 1,
    to_account_amount: sameMoney || resolvingDestination ? transaction.to_account_amount ?? (toAccount ? amount : null) : toAccount ? amount : null,
    to_account_currency: sameMoney ? transaction.to_account_currency : toAccount?.currency ?? null,
    recurring_transaction_id: transaction.recurring_transaction_id,
    date_time: transaction.date_time.slice(0, 10) === data.date ? transaction.date_time : dateToNoonUtc(data.date),
    notes: data.note || null,
    location_lat: transaction.location_lat,
    location_lng: transaction.location_lng,
    location_name: transaction.location_name,
    location_address: transaction.location_address,
    is_from_receipt: transaction.is_from_receipt,
    is_from_notification_parser: transaction.is_from_notification_parser,
    review_status: transaction.review_status,
    parser_notification_key: transaction.parser_notification_key,
    count_in_summary: transaction.count_in_summary,
    summary_amount: transaction.summary_amount,
    updated_at: updatedAt,
    deleted_at: null,
    version: transaction.version,
  };
}

function splitPayload(
  split: SyncTransactionSplit | undefined,
  transactionId: string,
  categoryId: string,
  amount: number,
  name: string,
  updatedAt: string
) {
  return {
    id: split?.id ?? crypto.randomUUID(),
    transaction_id: transactionId,
    category_id: categoryId,
    amount: money(amount),
    name,
    quantity: split?.quantity ?? 1,
    unit: split?.unit ?? 'pcs',
    unit_price: money(amount),
    updated_at: updatedAt,
    deleted_at: null,
    version: split?.version ?? 1,
  };
}

async function executeUpdateTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane transakcji.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const transaction = changes.transactions.find(t => t.id === data.id && !t.deleted_at);
  if (!transaction) return { ok: false, message: 'Nie znaleziono transakcji.' };
  if (transaction.version !== data.expectedVersion) return { ok: false, message: 'Transakcja zmieniła się na innym urządzeniu. Odśwież dane przed zapisem.' };

  const fromAccount = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && (a.is_active || a.id === transaction.from_account_id));
  if (!fromAccount) return { ok: false, message: 'Wybierz aktywne konto.' };

  const toAccount = data.type === 'transfer'
    ? changes.accounts.find(a => a.id === data.toAccountId && !a.deleted_at && (a.is_active || a.id === transaction.to_account_id)) ?? null
    : null;
  const keepsMissingDestination = transaction.account_link_state === 'MISSING_DESTINATION' &&
    data.type === 'transfer' && !data.toAccountId;
  if (data.type === 'transfer' && !toAccount && !keepsMissingDestination) return { ok: false, message: 'Wybierz konto docelowe.' };
  const resolvingDestination = transaction.account_link_state === 'MISSING_DESTINATION' && data.type === 'transfer' && toAccount !== null;
  if (resolvingDestination && !data.confirmDestinationBalanceChange) {
    return { ok: false, message: 'Potwierdź wpływ przypisania celu na jego saldo.' };
  }
  if (resolvingDestination && ((transaction.to_account_currency && transaction.to_account_currency !== toAccount.currency) ||
      (!transaction.to_account_amount && toAccount.currency !== fromAccount.currency))) {
    return { ok: false, message: 'Waluta celu lub brak kwoty docelowej wymaga uzupełnienia w aplikacji mobilnej.' };
  }
  if (data.type === 'transfer' && toAccount?.id === fromAccount.id) {
    return { ok: false, message: 'Konta transferu muszą być różne.' };
  }

  const moneyChanged = transaction.type !== data.type.toUpperCase() || transaction.from_account_id !== fromAccount.id ||
    transaction.to_account_id !== (toAccount?.id ?? null) || Number(transaction.total_amount) !== data.amount;
  const onlyResolvingDestination = resolvingDestination && transaction.from_account_id === fromAccount.id && Number(transaction.total_amount) === data.amount;
  if (resolvingDestination && !onlyResolvingDestination) return { ok: false, message: 'Uzupełnij cel oddzielnie od zmiany kwoty lub konta źródłowego.' };
  if (keepsMissingDestination && moneyChanged) {
    return { ok: false, message: 'Przy brakującym celu zachowaj kwotę i konto źródłowe albo najpierw uzupełnij cel.' };
  }
  if (moneyChanged && !onlyResolvingDestination && (transaction.transaction_currency && transaction.transaction_currency !== transaction.account_currency ||
      toAccount && toAccount.currency !== fromAccount.currency || transaction.purpose && transaction.purpose !== 'STANDARD')) {
    return { ok: false, message: 'Kwotę i konta operacji walutowej lub zakupu aktywa zmień w aplikacji mobilnej.' };
  }

  const category = data.type === 'transfer'
    ? null
    : changes.categories.find(c => c.id === data.categoryId && !c.deleted_at);
  if (data.type !== 'transfer' && !category) return { ok: false, message: 'Wybierz kategorię.' };
  if (moneyChanged && transaction.purpose && transaction.purpose !== 'STANDARD') return { ok: false, message: 'Operację na aktywach zmień w aplikacji mobilnej.' };

  const updatedAt = nowIso();
  const existingSplits = changes.transaction_splits.filter(split => split.transaction_id === transaction.id && !split.deleted_at);
  // A locked category may stay on the transaction, but it cannot be newly chosen.
  if (category?.is_locked && existingSplits[0]?.category_id !== category.id) {
    return { ok: false, message: LOCKED_CATEGORY_MESSAGE };
  }
  const splitsUnchanged = transaction.type === data.type.toUpperCase() && Number(transaction.total_amount) === data.amount &&
    (data.type === 'transfer' || existingSplits[0]?.category_id === category?.id);
  if (!splitsUnchanged && existingSplits.length > 1) return { ok: false, message: 'Transakcję z wieloma pozycjami zmień w aplikacji mobilnej.' };
  const transactionSplits = splitsUnchanged ? [] : data.type === 'transfer'
    ? existingSplits.map(split => cloneSplitForDeletion(split, updatedAt))
    : [
        splitPayload(existingSplits[0], transaction.id, category!.id, data.amount, data.note || '', updatedAt),
        ...existingSplits.slice(1).map(split => cloneSplitForDeletion(split, updatedAt)),
      ];

  const sync = await postSyncChanges({
    transactions: [cloneTransactionForUpdate(transaction, data, fromAccount, toAccount, updatedAt)],
    transaction_splits: transactionSplits,
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zaktualizować transakcji.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/budget');
  revalidatePath('/categories');
  return { ok: true, id: transaction.id, message: 'Transakcja została zaktualizowana.' };
}

async function executeDeleteTransactionAction(transactionId: string): Promise<ActionResult> {
  return deleteTransactionsAction([transactionId]);
}

async function executeDeleteTransactionsAction(transactionIds: string[]): Promise<ActionResult> {
  const ids = Array.from(new Set(transactionIds.filter(Boolean)));
  if (ids.length === 0) return { ok: false, message: 'Wybierz transakcje do usunięcia.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const transactions = ids.map(id => changes.transactions.find(t => t.id === id && !t.deleted_at));
  if (transactions.some(transaction => !transaction)) return { ok: false, message: 'Nie znaleziono części transakcji.' };

  const updatedAt = nowIso();
  const selectedIdSet = new Set(ids);
  const sync = await postSyncChanges({
    transactions: (transactions as SyncTransaction[]).map(transaction => cloneTransactionForDeletion(transaction, updatedAt)),
    transaction_splits: changes.transaction_splits
      .filter(split => split.transaction_id && selectedIdSet.has(split.transaction_id) && !split.deleted_at)
      .map(split => cloneSplitForDeletion(split, updatedAt)),
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć transakcji.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/transactions');
  revalidatePath('/');
  return {
    ok: true,
    message: ids.length === 1 ? 'Transakcja została usunięta.' : `Usunięto transakcje: ${ids.length}.`,
  };
}

async function executeCreateSettlementAction(input: unknown): Promise<ActionResult> {
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane rozliczenia.' };
  }

  const data = parsed.data;
  const amount = roundMoney(data.amount);
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!account) return { ok: false, message: 'Wybierz aktywne konto.' };

  const updatedAt = nowIso();
  const transactionId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();
  const transactionType = data.direction === 'LENT' ? 'EXPENSE' : 'INCOME';
  const sync = await postSyncChanges({
    accounts: [cloneAccountWithBalance(
      account,
      balanceAfterTransaction(account, parseFloat(account.balance), transactionType, 'FROM', amount),
      updatedAt
    )],
    transactions: [
      ledgerTransactionPayload({
        id: transactionId,
        type: transactionType,
        amount,
        account,
        date: data.date,
        note: `Rozliczenie: ${data.counterpartyName}`,
        updatedAt,
      }),
    ],
    settlements: [
      {
        id: settlementId,
        direction: data.direction,
        account_id: account.id,
        transaction_id: transactionId,
        counterparty_name: data.counterpartyName,
        counterparty_email: data.counterpartyEmail || null,
        total_amount: money(amount),
        currency: account.currency,
        note: data.note || null,
        due_date: data.dueDate ? dateToNoonUtc(data.dueDate) : null,
        reminder_days_before: String(data.reminderDaysBefore),
        status: 'ACTIVE',
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać rozliczenia.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: settlementId, message: 'Rozliczenie zostało zapisane.' };
}

async function addSettlementPayment({
  settlementId,
  accountId,
  amount,
  paidAt,
  note,
  ledgerNotePrefix,
}: {
  settlementId: string;
  accountId: string;
  amount: number;
  paidAt: string;
  note: string;
  ledgerNotePrefix: 'Spłata rozliczenia:' | 'Rozliczenie do zera:';
}): Promise<ActionResult> {
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const settlement = (changes.settlements ?? []).find(item => item.id === settlementId && !item.deleted_at);
  if (!settlement) return { ok: false, message: 'Nie znaleziono rozliczenia.' };
  if (settlement.status === 'SETTLED') return { ok: false, message: 'To rozliczenie jest już zamknięte.' };

  const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at && a.is_active);
  if (!account) return { ok: false, message: 'Wybierz aktywne konto.' };
  if (account.currency !== settlement.currency) return { ok: false, message: `Wybierz konto w walucie ${settlement.currency}.` };

  const repaid = (changes.settlement_payments ?? [])
    .filter(payment => payment.settlement_id === settlement.id && !payment.deleted_at)
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const remaining = Math.max(parseFloat(settlement.total_amount) - repaid, 0);
  const cappedAmount = roundMoney(Math.min(roundMoney(amount), remaining));
  if (cappedAmount < 0.01) return { ok: false, message: 'Rozliczenie nie ma pozostałej kwoty.' };

  const updatedAt = nowIso();
  const transactionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const transactionType = settlement.direction === 'LENT' ? 'INCOME' : 'EXPENSE';
  const isFullyPaid = roundMoney(remaining - cappedAmount) < 0.01;
  const sync = await postSyncChanges({
    accounts: [cloneAccountWithBalance(
      account,
      balanceAfterTransaction(account, parseFloat(account.balance), transactionType, 'FROM', cappedAmount),
      updatedAt
    )],
    transactions: [
      ledgerTransactionPayload({
        id: transactionId,
        type: transactionType,
        amount: cappedAmount,
        account,
        date: paidAt,
        note: `${ledgerNotePrefix} ${settlement.counterparty_name}`,
        updatedAt,
      }),
    ],
    settlement_payments: [
      {
        id: paymentId,
        settlement_id: settlement.id,
        account_id: account.id,
        transaction_id: transactionId,
        amount: money(cappedAmount),
        paid_at: dateToNoonUtc(paidAt),
        note: note || null,
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
    settlements: isFullyPaid ? [settlementStatusPayload(settlement, 'SETTLED', updatedAt)] : [],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać wpłaty.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: paymentId, message: isFullyPaid ? 'Rozliczenie zostało zamknięte.' : 'Wpłata została zapisana.' };
}

async function executeAddSettlementPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = settlementPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane wpłaty.' };
  }

  return addSettlementPayment({
    ...parsed.data,
    ledgerNotePrefix: 'Spłata rozliczenia:',
  });
}

async function executeSettleSettlementAction(input: unknown): Promise<ActionResult> {
  const parsed = settleSettlementInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane rozliczenia.' };
  }

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };
  const settlement = (changes.settlements ?? []).find(item => item.id === parsed.data.settlementId && !item.deleted_at);
  if (!settlement) return { ok: false, message: 'Nie znaleziono rozliczenia.' };
  const repaid = (changes.settlement_payments ?? [])
    .filter(payment => payment.settlement_id === settlement.id && !payment.deleted_at)
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const remaining = Math.max(parseFloat(settlement.total_amount) - repaid, 0);

  if (remaining <= 0) {
    const updatedAt = nowIso();
    const sync = await postSyncChanges({
      settlements: [settlementStatusPayload(settlement, 'SETTLED', updatedAt)],
    }, changes.syncResetGeneration);
    const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zamknąć rozliczenia.';
    if (failure) return { ok: false, message: failure };
    revalidateFinancePaths();
    return { ok: true, id: settlement.id, message: 'Rozliczenie zostało zamknięte.' };
  }

  return addSettlementPayment({
    settlementId: parsed.data.settlementId,
    accountId: parsed.data.accountId,
    amount: remaining,
    paidAt: parsed.data.paidAt,
    note: '',
    ledgerNotePrefix: 'Rozliczenie do zera:',
  });
}

async function executeDeleteSettlementAction(settlementId: string): Promise<ActionResult> {
  if (!settlementId) return { ok: false, message: 'Nie wybrano rozliczenia.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const settlement = (changes.settlements ?? []).find(item => item.id === settlementId && !item.deleted_at);
  if (!settlement) return { ok: false, message: 'Nie znaleziono rozliczenia.' };

  const payments = (changes.settlement_payments ?? []).filter(payment => payment.settlement_id === settlement.id && !payment.deleted_at);
  const linkedTransactionIds = new Set(
    [settlement.transaction_id, ...payments.map(payment => payment.transaction_id)].filter(Boolean) as string[]
  );
  const transactions = changes.transactions.filter(transaction => linkedTransactionIds.has(transaction.id) && !transaction.deleted_at);

  const updatedAt = nowIso();
  const accountBalances = new Map<string, number>();
  const getAccountBalance = (accountId: string) => {
    if (accountBalances.has(accountId)) return accountBalances.get(accountId)!;
    const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at);
    if (!account) return null;
    const balance = parseFloat(account.balance);
    accountBalances.set(accountId, balance);
    return balance;
  };

  for (const transaction of transactions) {
    const amount = parseFloat(transaction.total_amount);
    const fromBalance = getAccountBalance(transaction.from_account_id);
    const fromAccount = changes.accounts.find(a => a.id === transaction.from_account_id && !a.deleted_at);
    if (fromBalance === null) return { ok: false, message: 'Nie znaleziono konta powiązanej transakcji.' };
    if (!fromAccount) return { ok: false, message: 'Nie znaleziono konta powiązanej transakcji.' };

    accountBalances.set(
      transaction.from_account_id,
      balanceAfterTransaction(fromAccount, fromBalance, transaction.type, 'FROM', amount, -1)
    );

    if (transaction.type === 'TRANSFER' && transaction.to_account_id) {
      const toBalance = getAccountBalance(transaction.to_account_id);
      const toAccount = changes.accounts.find(a => a.id === transaction.to_account_id && !a.deleted_at);
      if (toBalance === null) return { ok: false, message: 'Nie znaleziono konta docelowego powiązanej transakcji.' };
      if (!toAccount) return { ok: false, message: 'Nie znaleziono konta docelowego powiązanej transakcji.' };
      accountBalances.set(
        transaction.to_account_id,
        balanceAfterTransaction(toAccount, toBalance, transaction.type, 'TO', amount, -1)
      );
    }
  }

  const accounts = Array.from(accountBalances.entries()).map(([accountId, balance]) => {
    const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at)!;
    return cloneAccountWithBalance(account, balance, updatedAt);
  });

  const sync = await postSyncChanges({
    accounts,
    transactions: transactions.map(transaction => cloneTransactionForDeletion(transaction, updatedAt)),
    transaction_splits: changes.transaction_splits
      .filter(split => split.transaction_id && linkedTransactionIds.has(split.transaction_id) && !split.deleted_at)
      .map(split => cloneSplitForDeletion(split, updatedAt)),
    settlements: [cloneSettlementForDeletion(settlement, updatedAt)],
    settlement_payments: payments.map(payment => cloneSettlementPaymentForDeletion(payment, updatedAt)),
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć rozliczenia.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: settlement.id, message: 'Rozliczenie zostało usunięte.' };
}

async function executeCreateRecurringTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = recurringInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane opłaty stałej.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!account) return { ok: false, message: 'Wybierz aktywne konto.' };

  const expectedCategoryType = data.type === 'income' ? 'INCOME' : 'EXPENSE';
  const category = changes.categories.find(c => c.id === data.categoryId && !c.deleted_at);
  if (!category || (category.types.length > 0 && !category.types.includes(expectedCategoryType))) {
    return { ok: false, message: 'Wybierz kategorię zgodną z typem opłaty.' };
  }
  if (category.is_locked) return { ok: false, message: LOCKED_CATEGORY_MESSAGE };

  const updatedAt = nowIso();
  const amount = money(data.amount);
  const recurringId = crypto.randomUUID();
  const sync = await postSyncChanges({
    recurring_transactions: [
      {
        id: recurringId,
        from_account_id: account.id,
        to_account_id: null,
        type: data.type.toUpperCase(),
        total_amount: amount,
        account_currency: account.currency,
        transaction_amount: amount,
        transaction_currency: account.currency,
        exchange_rate: 1,
        to_account_amount: null,
        to_account_currency: null,
        notes: data.notes || null,
        location_lat: null,
        location_lng: null,
        location_name: null,
        location_address: null,
        count_in_summary: true,
        summary_amount: null,
        frequency: data.frequency,
        interval_value: data.intervalValue,
        start_date: data.startDate,
        end_date: data.endDate || null,
        last_generated_date: null,
        skipped_occurrence_dates: [],
        category_splits: [{ category_id: category.id, amount }],
        recurring_category: data.recurringCategory,
        recurring_category_label: data.recurringCategoryLabel || null,
        is_active: true,
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać opłaty stałej.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/recurring');
  revalidatePath('/');
  revalidatePath('/reports');
  return { ok: true, id: recurringId, message: 'Opłata stała została zapisana.' };
}

async function executeDeleteRecurringTransactionAction(recurringId: string): Promise<ActionResult> {
  if (!recurringId) return { ok: false, message: 'Nie wybrano opłaty stałej.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const recurring = (changes.recurring_transactions ?? []).find(item => item.id === recurringId && !item.deleted_at);
  if (!recurring) return { ok: false, message: 'Nie znaleziono opłaty stałej.' };

  const updatedAt = nowIso();
  const sync = await postSyncChanges({
    recurring_transactions: [cloneRecurringForDeletion(recurring, updatedAt)],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć opłaty stałej.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/recurring');
  revalidatePath('/');
  revalidatePath('/reports');
  return { ok: true, id: recurring.id, message: 'Opłata stała została usunięta.' };
}

async function executeCreateAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane konta.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const normalizedName = normalizeName(parsed.data.name);
  if (changes.accounts.some(account => !account.deleted_at && normalizeName(account.name) === normalizedName)) {
    return { ok: false, message: 'Konto o tej nazwie już istnieje.' };
  }
  const liabilityError = validateAccountLiabilityInput(parsed.data, null, changes);
  if (liabilityError) return { ok: false, message: liabilityError };

  const updatedAt = nowIso();
  const maxSort = Math.max(0, ...changes.accounts.map(account => account.sort_order));
  const payload = accountPayload(parsed.data, undefined, maxSort + 1, updatedAt);
  const sync = await postSyncChanges({ accounts: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać konta.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/accounts');
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/reports');
  return { ok: true, id: payload.id, message: 'Konto zostało zapisane.' };
}

async function executeUpdateAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = accountUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane konta.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = changes.accounts.find(account => account.id === parsed.data.id && !account.deleted_at);
  if (!existing) return { ok: false, message: 'Nie znaleziono konta.' };

  const normalizedName = normalizeName(parsed.data.name);
  if (changes.accounts.some(account => account.id !== existing.id && !account.deleted_at && normalizeName(account.name) === normalizedName)) {
    return { ok: false, message: 'Konto o tej nazwie już istnieje.' };
  }
  const liabilityError = validateAccountLiabilityInput(parsed.data, existing.id, changes);
  if (liabilityError) return { ok: false, message: liabilityError };

  const updatedAt = nowIso();
  const payload = accountPayload(parsed.data, existing, existing.sort_order, updatedAt);
  const sync = await postSyncChanges({ accounts: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zaktualizować konta.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/accounts');
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/reports');
  return { ok: true, id: existing.id, message: 'Konto zostało zaktualizowane.' };
}

async function executeDeleteAccountAction(accountId: string): Promise<ActionResult> {
  if (!accountId) return { ok: false, message: 'Nie wybrano konta.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = changes.accounts.find(account => account.id === accountId && !account.deleted_at);
  if (!existing) return { ok: false, message: 'Nie znaleziono konta.' };
  const hasTransactions = changes.transactions.some(transaction => !transaction.deleted_at && (
    transaction.from_account_id === existing.id || transaction.to_account_id === existing.id
  ));
  if (existing.is_default && changes.accounts.filter(account => !account.deleted_at && account.is_active).length > 1) {
    return { ok: false, message: 'Nie usuwaj domyślnego konta przed zmianą domyślnego w aplikacji mobilnej.' };
  }

  const updatedAt = nowIso();
  const payload = {
    ...cloneAccountWithBalance(existing, parseFloat(existing.balance), updatedAt),
    name: hasTransactions ? `${existing.name}_deleted_${Date.now()}` : existing.name,
    deleted_at: updatedAt,
  };
  const sync = await postSyncChanges({ accounts: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć konta.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/accounts');
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/reports');
  return { ok: true, id: existing.id, message: 'Konto zostało usunięte.' };
}

async function executeUpsertAccountInterestAction(input: unknown): Promise<ActionResult> {
  const parsed = accountInterestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne ustawienia oprocentowania.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(account => account.id === parsed.data.accountId && !account.deleted_at && account.is_active);
  if (!account) return { ok: false, message: 'Nie znaleziono konta.' };

  if (parsed.data.afterMaturityAction === 'TRANSFER') {
    const targetAccount = changes.accounts.find(account => account.id === parsed.data.targetAccountId && !account.deleted_at && account.is_active);
    if (!targetAccount) return { ok: false, message: 'Wybierz konto docelowe transferu odsetek.' };
    if (targetAccount.id === account.id) return { ok: false, message: 'Konto docelowe musi być inne niż konto oprocentowane.' };
  }

  if (parsed.data.interestCategoryId) {
    const category = changes.categories.find(category => category.id === parsed.data.interestCategoryId && !category.deleted_at);
    if (!category || !category.types.includes('INCOME')) return { ok: false, message: 'Wybierz kategorię przychodową dla odsetek.' };
  }

  const existing = (changes.account_interest ?? []).find(interest => interest.account_id === account.id && !interest.deleted_at);
  const updatedAt = nowIso();
  const payload = accountInterestPayload(parsed.data, existing, updatedAt);
  const sync = await postSyncChanges({ account_interest: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać oprocentowania.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/accounts');
  revalidatePath('/');
  revalidatePath('/reports');
  return { ok: true, id: payload.id, message: 'Oprocentowanie zostało zapisane.' };
}

async function executeDeleteAccountInterestAction(accountId: string): Promise<ActionResult> {
  if (!accountId) return { ok: false, message: 'Nie wybrano konta.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = (changes.account_interest ?? []).find(interest => interest.account_id === accountId && !interest.deleted_at);
  if (!existing) return { ok: true, message: 'Oprocentowanie jest wyłączone.' };

  const updatedAt = nowIso();
  const payload = accountInterestPayload({
    accountId: existing.account_id ?? accountId,
    annualRatePercent: existing.annual_rate_percent,
    baseAmount: existing.base_amount === null ? null : parseFloat(existing.base_amount),
    startDate: existing.start_date.slice(0, 10),
    endDate: existing.end_date.slice(0, 10),
    taxRatePercent: existing.tax_rate_percent,
    afterMaturityAction: existing.after_maturity_action,
    targetAccountId: existing.target_account_id,
    interestCategoryId: existing.interest_category_id,
    monthlyPayment: existing.monthly_payment === null ? null : parseFloat(existing.monthly_payment),
    originalLoanAmount: existing.original_loan_amount === null ? null : parseFloat(existing.original_loan_amount),
  }, existing, updatedAt, updatedAt);
  const sync = await postSyncChanges({ account_interest: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się wyłączyć oprocentowania.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/accounts');
  revalidatePath('/');
  revalidatePath('/reports');
  return { ok: true, id: existing.id, message: 'Oprocentowanie zostało wyłączone.' };
}

async function executeCreateInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  const parsed = investmentHoldingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane inwestycji.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(account => account.id === parsed.data.accountId);
  if (!isActiveInvestmentAssetAccount(account)) return { ok: false, message: 'Wybierz aktywne konto inwestycyjne.' };

  const normalizedSymbol = parsed.data.symbol.toLocaleUpperCase('pl-PL');
  const existing = (changes.investment_holdings ?? []).find(
    holding => !holding.deleted_at && holding.account_id === account.id && holding.symbol.toLocaleUpperCase('pl-PL') === normalizedSymbol
  );
  const updatedAt = nowIso();
  const cost = parsed.data.quantity * parsed.data.unitPrice;
  const transactionId = crypto.randomUUID();
  const holding = existing
    ? investmentHoldingPayload(
        parsed.data,
        existing,
        updatedAt,
        existing.quantity + parsed.data.quantity,
        ((existing.quantity * parseFloat(existing.unit_price)) + cost) / (existing.quantity + parsed.data.quantity)
      )
    : investmentHoldingPayload(parsed.data, undefined, updatedAt);

  const sync = await postSyncChanges({
    investment_holdings: [holding],
    investment_transactions: [
      {
        id: transactionId,
        holding_id: holding.id,
        type: 'BUY',
        quantity: parsed.data.quantity,
        unit_price: money(parsed.data.unitPrice),
        currency: parsed.data.currency,
        date: updatedAt,
        notes: parsed.data.notes || null,
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać inwestycji.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: holding.id, message: existing ? 'Pozycja została powiększona.' : 'Pozycja została dodana.' };
}

async function executeUpdateInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  const parsed = investmentHoldingUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane inwestycji.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = (changes.investment_holdings ?? []).find(holding => holding.id === parsed.data.id && !holding.deleted_at);
  if (!existing) return { ok: false, message: 'Nie znaleziono pozycji.' };

  const account = changes.accounts.find(account => account.id === parsed.data.accountId);
  if (!isActiveInvestmentAssetAccount(account)) return { ok: false, message: 'Wybierz aktywne konto inwestycyjne.' };

  const normalizedSymbol = parsed.data.symbol.toLocaleUpperCase('pl-PL');
  const duplicate = (changes.investment_holdings ?? []).some(
    holding => holding.id !== existing.id && !holding.deleted_at && holding.account_id === account.id && holding.symbol.toLocaleUpperCase('pl-PL') === normalizedSymbol
  );
  if (duplicate) return { ok: false, message: 'Ta pozycja już istnieje na wybranym koncie.' };

  const updatedAt = nowIso();
  const sync = await postSyncChanges({
    investment_holdings: [investmentHoldingPayload(parsed.data, existing, updatedAt)],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zaktualizować pozycji.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: existing.id, message: 'Pozycja została zaktualizowana.' };
}

async function executeTradeInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  const parsed = investmentTradeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane operacji.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const holding = (changes.investment_holdings ?? []).find(item => item.id === parsed.data.holdingId && !item.deleted_at);
  if (!holding) return { ok: false, message: 'Nie znaleziono pozycji.' };

  const account = changes.accounts.find(account => account.id === holding.account_id);
  if (!isActiveInvestmentAssetAccount(account)) return { ok: false, message: 'Nie znaleziono aktywnego konta inwestycyjnego.' };

  if (parsed.data.type === 'SELL' && parsed.data.quantity > holding.quantity) {
    return { ok: false, message: 'Nie możesz sprzedać więcej jednostek niż posiadasz.' };
  }

  const updatedAt = nowIso();
  const value = parsed.data.quantity * parsed.data.unitPrice;
  const accountBalance = parseFloat(account.balance);
  if (!Number.isFinite(accountBalance)) return { ok: false, message: 'Saldo konta inwestycyjnego jest niepoprawne.' };
  if (parsed.data.type === 'BUY' && value > accountBalance + 0.000001) {
    return { ok: false, message: 'Brak wystarczających wolnych środków na tym koncie.' };
  }
  const currentPrice = parseFloat(holding.unit_price);
  const newQuantity = parsed.data.type === 'BUY'
    ? holding.quantity + parsed.data.quantity
    : holding.quantity - parsed.data.quantity;
  const newUnitPrice = parsed.data.type === 'BUY' && newQuantity > 0
    ? ((holding.quantity * currentPrice) + value) / newQuantity
    : currentPrice;
  const balanceDelta = parsed.data.type === 'BUY' ? -value : value;

  const sync = await postSyncChanges({
    accounts: [cloneAccountWithBalance(account, parseFloat(account.balance) + balanceDelta, updatedAt)],
    investment_holdings: [
      {
        ...cloneInvestmentHoldingForDeletion(holding, updatedAt),
        quantity: newQuantity,
        unit_price: money(newUnitPrice),
        deleted_at: null,
      },
    ],
    investment_transactions: [
      {
        id: crypto.randomUUID(),
        holding_id: holding.id,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        unit_price: money(parsed.data.unitPrice),
        currency: holding.currency,
        date: updatedAt,
        notes: parsed.data.notes || null,
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      },
    ],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać operacji.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: holding.id, message: parsed.data.type === 'BUY' ? 'Kupno zostało zapisane.' : 'Sprzedaż została zapisana.' };
}

async function executeDeleteInvestmentHoldingAction(holdingId: string): Promise<ActionResult> {
  if (!holdingId) return { ok: false, message: 'Nie wybrano pozycji.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const holding = (changes.investment_holdings ?? []).find(item => item.id === holdingId && !item.deleted_at);
  if (!holding) return { ok: false, message: 'Nie znaleziono pozycji.' };

  const updatedAt = nowIso();
  const transactions = (changes.investment_transactions ?? []).filter(tx => tx.holding_id === holding.id && !tx.deleted_at);
  const sync = await postSyncChanges({
    investment_holdings: [cloneInvestmentHoldingForDeletion(holding, updatedAt)],
    investment_transactions: transactions.map(tx => cloneInvestmentTransactionForDeletion(tx, updatedAt)),
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć pozycji.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: holding.id, message: 'Pozycja została usunięta.' };
}

function categoryHasDescendant(categories: SyncCategory[], parentId: string, childId: string): boolean {
  const childrenByParent = new Map<string, SyncCategory[]>();
  for (const category of categories.filter(item => !item.deleted_at)) {
    if (!category.parent_category_id) continue;
    const children = childrenByParent.get(category.parent_category_id) ?? [];
    children.push(category);
    childrenByParent.set(category.parent_category_id, children);
  }

  const stack = [...(childrenByParent.get(parentId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.id === childId) return true;
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }
  return false;
}

function validateCategoryParent(data: z.infer<typeof categoryInputSchema>, categories: SyncCategory[], editingId?: string) {
  if (!data.parentCategoryId) return null;
  if (data.parentCategoryId === editingId) return 'Kategoria nie może być własnym rodzicem.';
  const parent = categories.find(category => category.id === data.parentCategoryId && !category.deleted_at);
  if (!parent) return 'Nie znaleziono kategorii nadrzędnej.';
  if (parent.parent_category_id) return 'Podkategorie mogą mieć tylko kategorię główną jako rodzica.';
  if (editingId && categoryHasDescendant(categories, editingId, data.parentCategoryId)) {
    return 'Nie można przenieść kategorii pod jej podkategorię.';
  }
  const missingType = data.types.some(type => !parent.types.includes(type));
  if (missingType) return 'Podkategoria musi mieć typ zgodny z kategorią nadrzędną.';
  return null;
}

async function executeCreateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane kategorii.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const normalizedName = normalizeName(parsed.data.name);
  if (changes.categories.some(category => !category.deleted_at && normalizeName(category.name) === normalizedName)) {
    return { ok: false, message: 'Kategoria o tej nazwie już istnieje.' };
  }
  const parentError = validateCategoryParent(parsed.data, changes.categories);
  if (parentError) return { ok: false, message: parentError };

  const updatedAt = nowIso();
  const maxSort = Math.max(0, ...changes.categories.map(category => category.sort_order));
  const payload = categoryPayload(parsed.data, undefined, maxSort + 1, updatedAt);
  const sync = await postSyncChanges({ categories: [payload] }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać kategorii.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/budget');
  revalidatePath('/reports');
  return { ok: true, id: payload.id, message: 'Kategoria została zapisana.' };
}

async function executeUpdateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane kategorii.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = changes.categories.find(category => category.id === parsed.data.id && !category.deleted_at);
  if (!existing) return { ok: false, message: 'Nie znaleziono kategorii.' };
  if (existing.is_system) return { ok: false, message: 'Kategorii systemowej nie można edytować w webie.' };

  const normalizedName = normalizeName(parsed.data.name);
  if (changes.categories.some(category => category.id !== existing.id && !category.deleted_at && normalizeName(category.name) === normalizedName)) {
    return { ok: false, message: 'Kategoria o tej nazwie już istnieje.' };
  }
  const parentError = validateCategoryParent(parsed.data, changes.categories, existing.id);
  if (parentError) return { ok: false, message: parentError };

  const updatedAt = nowIso();
  const sync = await postSyncChanges({
    categories: [categoryPayload(parsed.data, existing, existing.sort_order, updatedAt)],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zaktualizować kategorii.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/budget');
  revalidatePath('/reports');
  return { ok: true, id: existing.id, message: 'Kategoria została zaktualizowana.' };
}

async function executeDeleteCategoryAction(categoryId: string): Promise<ActionResult> {
  if (!categoryId) return { ok: false, message: 'Nie wybrano kategorii.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = changes.categories.find(category => category.id === categoryId && !category.deleted_at);
  if (!existing) return { ok: false, message: 'Nie znaleziono kategorii.' };
  if (existing.is_system) return { ok: false, message: 'Kategorii systemowej nie można usunąć w webie.' };

  const updatedAt = nowIso();
  const children = changes.categories.filter(category => category.parent_category_id === existing.id && !category.deleted_at);
  const payloads = [
    cloneCategoryForDeletion(existing, updatedAt),
    ...children.map(child => cloneCategoryForDeletion(child, updatedAt)),
  ];
  const relatedBudgetIds = new Set(payloads.map(category => category.id));
  const budgetPayloads = changes.category_budgets
    .filter(budget => budget.category_id && relatedBudgetIds.has(budget.category_id) && !budget.deleted_at)
    .map(budget => ({
      id: budget.id,
      category_id: budget.category_id,
      type: budget.type,
      budget_amount: budget.budget_amount,
      updated_at: updatedAt,
      deleted_at: updatedAt,
      version: budget.version,
    }));
  const sync = await postSyncChanges({ categories: payloads, category_budgets: budgetPayloads }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć kategorii.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/budget');
  revalidatePath('/reports');
  return { ok: true, id: existing.id, message: 'Kategoria została usunięta.' };
}

const budgetInputSchema = z.object({
  amount: z.coerce.number().min(0),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

function overallBudgetPayload(existing: SyncOverallBudget | undefined, amount: number, updatedAt: string) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    budget_amount: money(amount),
    updated_at: updatedAt,
    deleted_at: amount > 0 ? null : updatedAt,
    version: existing?.version ?? 1,
  };
}

function overallBudgetOverridePayload(existing: SyncOverallBudgetOverride | undefined, yearMonth: string, amount: number, updatedAt: string) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    year_month: yearMonth,
    budget_amount: money(amount),
    updated_at: updatedAt,
    deleted_at: null,
    version: existing?.version ?? 1,
  };
}

async function executeUpsertOverallBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Podaj poprawną kwotę budżetu.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const updatedAt = nowIso();
  const sync = parsed.data.yearMonth
    ? await postSyncChanges({
        overall_budget_overrides: [
          overallBudgetOverridePayload(
            (changes.overall_budget_overrides ?? []).find(
              budget => budget.year_month === parsed.data.yearMonth && !budget.deleted_at
            ),
            parsed.data.yearMonth,
            parsed.data.amount,
            updatedAt
          ),
        ],
      }, changes.syncResetGeneration)
    : await postSyncChanges({
        overall_budgets: [
          overallBudgetPayload(changes.overall_budgets.find(b => !b.deleted_at), parsed.data.amount, updatedAt),
        ],
      }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać budżetu.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/budget');
  revalidatePath('/');
  return { ok: true, message: parsed.data.amount > 0 ? 'Budżet ogólny został zapisany.' : 'Budżet ogólny został wyłączony.' };
}

const categoryBudgetInputSchema = budgetInputSchema.extend({
  categoryId: z.string().min(1),
});

const accountBudgetInputSchema = budgetInputSchema.extend({
  accountId: z.string().min(1),
});

function categoryBudgetPayload(existing: SyncCategoryBudget | undefined, categoryId: string, amount: number, updatedAt: string) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    category_id: categoryId,
    type: 'EXPENSE_BUDGET',
    budget_amount: money(amount),
    updated_at: updatedAt,
    deleted_at: amount > 0 ? null : updatedAt,
    version: existing?.version ?? 1,
  };
}

async function executeUpsertCategoryBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryBudgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Podaj poprawny budżet kategorii.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const category = changes.categories.find(c => c.id === parsed.data.categoryId && !c.deleted_at);
  if (!category) return { ok: false, message: 'Nie znaleziono kategorii.' };

  const existing = changes.category_budgets.find(
    b => b.category_id === parsed.data.categoryId && b.type === 'EXPENSE_BUDGET' && !b.deleted_at
  );
  if (!existing && parsed.data.amount <= 0) return { ok: true, message: 'Budżet kategorii jest wyłączony.' };

  const updatedAt = nowIso();
  const sync = await postSyncChanges({
    category_budgets: [categoryBudgetPayload(existing, parsed.data.categoryId, parsed.data.amount, updatedAt)],
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać budżetu kategorii.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/budget');
  revalidatePath('/categories');
  revalidatePath('/');
  return { ok: true, message: parsed.data.amount > 0 ? 'Budżet kategorii został zapisany.' : 'Budżet kategorii został wyłączony.' };
}

function accountBudgetPayload(existing: SyncAccountBudget | undefined, accountId: string, amount: number, updatedAt: string) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    account_id: accountId,
    budget_amount: money(amount),
    updated_at: updatedAt,
    deleted_at: amount > 0 ? null : updatedAt,
    version: existing?.version ?? 1,
  };
}

function accountBudgetOverridePayload(existing: SyncAccountBudgetOverride | undefined, accountId: string, yearMonth: string, amount: number, updatedAt: string) {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    account_id: accountId,
    year_month: yearMonth,
    budget_amount: money(amount),
    updated_at: updatedAt,
    deleted_at: null,
    version: existing?.version ?? 1,
  };
}

async function executeUpsertAccountBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = accountBudgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Podaj poprawny budżet konta.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(item => item.id === parsed.data.accountId && !item.deleted_at && item.is_active);
  if (!account) return { ok: false, message: 'Nie znaleziono konta.' };

  const existing = (changes.account_budgets ?? []).find(
    budget => budget.account_id === account.id && !budget.deleted_at
  );
  const updatedAt = nowIso();

  const sync = parsed.data.yearMonth
    ? await postSyncChanges({
        account_budgets: existing || parsed.data.amount <= 0
          ? []
          : [accountBudgetPayload(existing, account.id, parsed.data.amount, updatedAt)],
        account_budget_overrides: [
          accountBudgetOverridePayload(
            (changes.account_budget_overrides ?? []).find(
              budget => budget.account_id === account.id && budget.year_month === parsed.data.yearMonth && !budget.deleted_at
            ),
            account.id,
            parsed.data.yearMonth,
            parsed.data.amount,
            updatedAt
          ),
        ],
      }, changes.syncResetGeneration)
    : await postSyncChanges({
        account_budgets: [accountBudgetPayload(existing, account.id, parsed.data.amount, updatedAt)],
      }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać budżetu konta.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/budget');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { ok: true, message: parsed.data.amount > 0 ? 'Budżet konta został zapisany.' : 'Budżet konta został wyłączony dla miesiąca.' };
}

function normalizeName(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('pl-PL');
}

function importedAccountPayload(name: string, balance: number, currency: string, sortOrder: number, updatedAt: string) {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'CASH',
    category: 'BASIC',
    balance: money(balance),
    currency,
    sort_order: sortOrder,
    is_default: false,
    is_active: true,
    include_in_net_worth: true,
    icon_name: 'account_balance_wallet',
    icon_bg: '#EEF2FF',
    icon_color: '#6366F1',
    notes: 'Utworzone podczas importu web',
    liability_kind: null,
    credit_limit: null,
    statement_day: null,
    payment_due_day: null,
    liability_principal: null,
    liability_monthly_payment: null,
    payment_account_id: null,
    credit_card_last4: null,
    credit_card_theme: null,
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  };
}

function importedCategoryPayload(
  name: string,
  type: 'EXPENSE' | 'INCOME',
  sortOrder: number,
  updatedAt: string,
  parentCategoryId: string | null = null
) {
  return {
    id: crypto.randomUUID(),
    name,
    types: [type],
    icon_name: type === 'INCOME' ? 'payments' : 'receipt_long',
    icon_bg: type === 'INCOME' ? '#D1FAE5' : '#EEF2FF',
    icon_color: type === 'INCOME' ? '#10B981' : '#6366F1',
    sort_order: sortOrder,
    is_default: false,
    is_system: false,
    is_locked: false,
    default_key: '',
    parent_category_id: parentCategoryId,
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  };
}

async function executeConfirmImportAnalysisAction(input: unknown): Promise<ActionResult> {
  const parsed = importAnalysisSchema.extend({ submissionId: z.uuid(), submittedAt: z.iso.datetime() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Niepoprawny podgląd importu.' };
  if (parsed.data.transactions.length === 0) return { ok: false, message: 'Plik nie zawiera transakcji do importu.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existingIds = new Set(changes.transactions.map(row => row.id));
  const plannedIds = parsed.data.transactions.map((_, index) => submissionEntityId(parsed.data.submissionId, `transaction:${index}`));
  const present = plannedIds.filter(id => existingIds.has(id)).length;
  if (present === plannedIds.length) return { ok: true, message: 'Import został wcześniej zapisany.' };
  if (present > 0) return { ok: false, outcomeUnknown: true, message: 'Część tego importu jest już na serwerze. Sprawdź wynik przed kolejną próbą.' };
  const preflightError = importPreflight(parsed.data, changes.accounts);
  if (preflightError) return { ok: false, message: preflightError };
  const updatedAt = parsed.data.submittedAt;
  const accountByName = new Map(
    changes.accounts
      .filter(account => !account.deleted_at && account.is_active)
      .map(account => [normalizeName(account.name), account])
  );
  const categoryByName = new Map(
    changes.categories
      .filter(category => !category.deleted_at)
      .map(category => [normalizeName(category.name), category])
  );
  const importedBalanceByName = new Map(
    parsed.data.accounts.map(account => [normalizeName(account.name), account.balance])
  );
  const balanceByAccountId = new Map<string, number>();
  const fixedBalanceByAccountId = new Map<string, number>();
  const accountsToSync = new Map<string, SyncAccount | ReturnType<typeof importedAccountPayload>>();
  const categoriesToSync = new Map<string, SyncCategory | ReturnType<typeof importedCategoryPayload>>();
  const importCreatedCategoryIds = new Set<string>();
  let maxAccountSort = Math.max(0, ...changes.accounts.map(account => account.sort_order));
  let maxCategorySort = Math.max(0, ...changes.categories.map(category => category.sort_order));

  const resolveAccount = (name: string, currency: string) => {
    const normalized = normalizeName(name);
    const importedBalance = importedBalanceByName.get(normalized);
    const existing = accountByName.get(normalized);
    if (existing) {
      // Existing balances are authoritative. Import only the new ledger effects;
      // a file snapshot must not reset an account already in use.
      if (!balanceByAccountId.has(existing.id)) balanceByAccountId.set(existing.id, Number(existing.balance));
      return existing;
    }

    const account = { ...importedAccountPayload(name, importedBalance ?? 0, currency, ++maxAccountSort, updatedAt), id: submissionEntityId(parsed.data.submissionId, `account:${normalized}:${currency}`) };
    accountByName.set(normalized, account);
    balanceByAccountId.set(account.id, parseFloat(account.balance));
    if (importedBalance !== undefined && importedBalance !== null) fixedBalanceByAccountId.set(account.id, importedBalance);
    accountsToSync.set(account.id, account);
    return account;
  };

  const ensureCategoryType = (
    category: SyncCategory | ReturnType<typeof importedCategoryPayload>,
    type: 'EXPENSE' | 'INCOME'
  ) => {
    if (category.types.includes(type) || category.is_system) return category;
    const updated = {
      ...category,
      types: [...category.types, type],
      updated_at: updatedAt,
    };
    categoryByName.set(normalizeName(updated.name), updated);
    categoriesToSync.set(updated.id, updated);
    return updated;
  };

  const resolveSingleCategory = (name: string, type: 'EXPENSE' | 'INCOME', parentCategoryId: string | null = null) => {
    const displayName = name || 'Import';
    const normalized = normalizeName(displayName);
    const existing = categoryByName.get(normalized);
    if (existing) {
      const typed = ensureCategoryType(existing, type);
      if (
        parentCategoryId &&
        !typed.parent_category_id &&
        typed.parent_category_id !== parentCategoryId &&
        importCreatedCategoryIds.has(typed.id) &&
        !typed.is_system
      ) {
        const reparented = {
          ...typed,
          parent_category_id: parentCategoryId,
          updated_at: updatedAt,
        };
        categoryByName.set(normalized, reparented);
        categoriesToSync.set(reparented.id, reparented);
        return reparented;
      }
      return typed;
    }

    const category = { ...importedCategoryPayload(displayName, type, ++maxCategorySort, updatedAt, parentCategoryId), id: submissionEntityId(parsed.data.submissionId, `category:${normalized}`) };
    categoryByName.set(normalized, category);
    categoriesToSync.set(category.id, category);
    importCreatedCategoryIds.add(category.id);
    return category;
  };

  const resolveCategory = (name: string, type: 'EXPENSE' | 'INCOME', parentName?: string | null) => {
    const importedName = name || 'Import';
    const hierarchy = parentName?.trim()
      ? { parentName: parentName.trim(), categoryName: importedName.trim() || 'Import' }
      : inferImportedCategoryHierarchy(importedName);
    if (!hierarchy.parentName) return resolveSingleCategory(hierarchy.categoryName, type);

    const parent = resolveSingleCategory(hierarchy.parentName, type);
    if (parent.parent_category_id) {
      return resolveSingleCategory(importedName, type);
    }
    return resolveSingleCategory(hierarchy.categoryName, type, parent.id);
  };

  const transactions: Array<Record<string, unknown>> = [];
  const transactionSplits: Array<Record<string, unknown>> = [];

  for (const [index, imported] of parsed.data.transactions.entries()) {
    const fromAccount = resolveAccount(imported.from_account, imported.currency);
    const toAccount = imported.type === 'TRANSFER' && imported.to_account?.trim()
      ? resolveAccount(imported.to_account, imported.currency2 || imported.currency)
      : null;
    const category = imported.type === 'TRANSFER'
      ? null
      : resolveCategory(
        imported.to_category || (imported.type === 'INCOME' ? 'Przychody z importu' : 'Wydatki z importu'),
        imported.type,
        imported.to_category_parent
      );

    const transactionId = plannedIds[index];
    const amount = imported.amount;

    const fromBalance = balanceByAccountId.get(fromAccount.id) ?? parseFloat(fromAccount.balance);
    const importedType = imported.type as SyncTransaction['type'];
    if (!fixedBalanceByAccountId.has(fromAccount.id)) {
      balanceByAccountId.set(
        fromAccount.id,
        balanceAfterTransaction(fromAccount, fromBalance, importedType, 'FROM', amount)
      );
    }
    if (importedType === 'TRANSFER' && toAccount) {
      const toBalance = balanceByAccountId.get(toAccount.id) ?? parseFloat(toAccount.balance);
      if (!fixedBalanceByAccountId.has(toAccount.id)) {
        balanceByAccountId.set(
          toAccount.id,
          balanceAfterTransaction(toAccount, toBalance, importedType, 'TO', imported.amount2 ?? amount)
        );
      }
    }

    transactions.push({
      id: transactionId,
      type: imported.type,
      total_amount: money(amount),
      from_account_id: fromAccount.id,
      to_account_id: toAccount?.id ?? null,
      account_link_state: imported.type === 'TRANSFER' && !toAccount ? 'MISSING_DESTINATION' : 'COMPLETE',
      missing_destination_reason: imported.type === 'TRANSFER' && !toAccount ? imported.missing_destination_reason ?? 'ABSENT_IN_FILE' : null,
      account_currency: fromAccount.currency,
      transaction_amount: money(imported.transaction_amount ?? amount),
      transaction_currency: imported.transaction_currency ?? imported.currency,
      exchange_rate: null,
      to_account_amount: imported.type === 'TRANSFER' ? imported.amount2 ? money(imported.amount2) : toAccount ? money(amount) : null : null,
      to_account_currency: imported.type === 'TRANSFER' ? toAccount?.currency ?? imported.currency2 ?? null : null,
      recurring_transaction_id: null,
      date_time: dateToNoonUtc(imported.date),
      notes: imported.notes || null,
      location_lat: null,
      location_lng: null,
      location_name: null,
      location_address: null,
      is_from_receipt: false,
      is_from_notification_parser: false,
      review_status: null,
      parser_notification_key: null,
      count_in_summary: true,
      summary_amount: null,
      updated_at: updatedAt,
      deleted_at: null,
      version: 1,
    });

    if (category) {
      transactionSplits.push({
        id: submissionEntityId(parsed.data.submissionId, `split:${index}`),
        transaction_id: transactionId,
        category_id: category.id,
        amount: money(amount),
        name: imported.notes || '',
        quantity: 1,
        unit: 'pcs',
        unit_price: money(amount),
        updated_at: updatedAt,
        deleted_at: null,
        version: 1,
      });
    }
  }

  for (const [accountId, account] of accountsToSync) {
    const balance = balanceByAccountId.get(accountId);
    if (balance === undefined) throw new Error('Missing prepared import account balance');
    accountsToSync.set(accountId, cloneAccountWithBalance(account, balance, updatedAt));
  }

  const sync = await postSyncChanges({
    accounts: Array.from(accountsToSync.values()),
    categories: Array.from(categoriesToSync.values()),
    transactions,
    transaction_splits: transactionSplits,
  }, changes.syncResetGeneration);

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać importu.';
  if (failure) return { ok: false, message: failure, ...(sync && sync.errors.length === 0 ? { outcomeUnknown: true } : {}) };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/import-export');
  return { ok: true, message: `Zaimportowano transakcje: ${parsed.data.transactions.length}.` };
}

async function withSyncFailure(action: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SyncRequestError) return { ok: false, message: error.message, ...(error.code === 'outcome_unknown' || error.status >= 500 ? { outcomeUnknown: true } : {}) };
    throw error;
  }
}

export async function createTransactionAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateTransactionAction(input));
}

export async function updateTransactionAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpdateTransactionAction(input));
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteTransactionAction(transactionId));
}

export async function deleteTransactionsAction(transactionIds: string[]): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteTransactionsAction(transactionIds));
}

export async function createSettlementAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateSettlementAction(input));
}

export async function addSettlementPaymentAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeAddSettlementPaymentAction(input));
}

export async function settleSettlementAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeSettleSettlementAction(input));
}

export async function deleteSettlementAction(settlementId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteSettlementAction(settlementId));
}

export async function createRecurringTransactionAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateRecurringTransactionAction(input));
}

export async function deleteRecurringTransactionAction(recurringId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteRecurringTransactionAction(recurringId));
}

export async function createAccountAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateAccountAction(input));
}

export async function updateAccountAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpdateAccountAction(input));
}

export async function deleteAccountAction(accountId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteAccountAction(accountId));
}

export async function upsertAccountInterestAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpsertAccountInterestAction(input));
}

export async function deleteAccountInterestAction(accountId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteAccountInterestAction(accountId));
}

export async function createInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateInvestmentHoldingAction(input));
}

export async function updateInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpdateInvestmentHoldingAction(input));
}

export async function tradeInvestmentHoldingAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeTradeInvestmentHoldingAction(input));
}

export async function deleteInvestmentHoldingAction(holdingId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteInvestmentHoldingAction(holdingId));
}

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeCreateCategoryAction(input));
}

export async function updateCategoryAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpdateCategoryAction(input));
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  return withSyncFailure(() => executeDeleteCategoryAction(categoryId));
}

export async function upsertOverallBudgetAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpsertOverallBudgetAction(input));
}

export async function upsertCategoryBudgetAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpsertCategoryBudgetAction(input));
}

export async function upsertAccountBudgetAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeUpsertAccountBudgetAction(input));
}

export async function confirmImportAnalysisAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(() => executeConfirmImportAnalysisAction(input));
}

export async function reconcileSubmissionAction(input: unknown): Promise<ActionResult> {
  return withSyncFailure(async () => {
    const parsed = z.object({ id: z.uuid(), count: z.number().int().min(1).max(100000) }).safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Niepoprawna tożsamość operacji.' };
    const data = await getServerChanges();
    if (!data) return { ok: false, message: 'Nie udało się pobrać wyniku operacji.' };
    const ids = new Set(data.transactions.map(row => row.id));
    let found = 0;
    for (let index = 0; index < parsed.data.count; index++) {
      if (ids.has(submissionEntityId(parsed.data.id, `transaction:${index}`))) found++;
    }
    return { ok: true, found, total: parsed.data.count };
  });
}
