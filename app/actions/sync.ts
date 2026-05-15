'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fetchSync, postSyncChanges } from '@/lib/api';
import {
  SyncAccount,
  SyncCategoryBudget,
  SyncOverallBudget,
  SyncServerChanges,
  SyncSettlement,
  SyncTransaction,
  SyncTransactionSplit,
} from '@/lib/api-types';
import { importAnalysisSchema } from '@/lib/schemas/import-analysis';

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; message: string };

const transactionInputSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.coerce.number().positive('Podaj kwotę większą od zera.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.string().min(1),
  toAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional().default(''),
});

const transactionUpdateInputSchema = transactionInputSchema.extend({
  id: z.string().min(1),
});

const settlementInputSchema = z.object({
  direction: z.enum(['LENT', 'BORROWED']),
  amount: z.coerce.number().positive('Podaj kwotę większą od zera.'),
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
  amount: z.coerce.number().positive('Podaj kwotę większą od zera.'),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional().default(''),
});

const settleSettlementInputSchema = z.object({
  settlementId: z.string().min(1),
  accountId: z.string().min(1),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const money = (value: number) => value.toFixed(2);
const nowIso = () => new Date().toISOString();
const dateToNoonUtc = (date: string) => `${date}T12:00:00.000Z`;

function cloneAccountWithBalance(account: SyncAccount, balance: number, updatedAt: string) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    category: account.category,
    balance: money(balance),
    currency: account.currency,
    sort_order: account.sort_order,
    is_default: account.is_default,
    is_active: account.is_active,
    include_in_net_worth: account.include_in_net_worth,
    icon_name: account.icon_name ?? '',
    icon_bg: account.icon_bg ?? '#FFFFFF',
    icon_color: account.icon_color ?? '#000000',
    notes: account.notes,
    updated_at: updatedAt,
    deleted_at: null,
    version: account.version,
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
  revalidatePath('/settlements');
  revalidatePath('/reports');
}

function syncFailureMessage(errors: unknown[], conflicts: unknown[]) {
  if (errors.length > 0) return 'API odrzuciło zmianę. Sprawdź limity konta lub dane formularza.';
  if (conflicts.length > 0) return 'Zmiana ma konflikt z nowszymi danymi z serwera. Odśwież i spróbuj ponownie.';
  return null;
}

async function getServerChanges(): Promise<SyncServerChanges | null> {
  const sync = await fetchSync();
  return sync?.server_changes ?? null;
}

export async function createTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane transakcji.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const fromAccount = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!fromAccount) return { ok: false, message: 'Wybierz aktywne konto.' };

  const toAccount = data.type === 'transfer'
    ? changes.accounts.find(a => a.id === data.toAccountId && !a.deleted_at && a.is_active)
    : null;
  if (data.type === 'transfer' && !toAccount) return { ok: false, message: 'Wybierz konto docelowe.' };
  if (data.type === 'transfer' && toAccount?.id === fromAccount.id) {
    return { ok: false, message: 'Konta transferu muszą być różne.' };
  }

  const category = data.type === 'transfer'
    ? null
    : changes.categories.find(c => c.id === data.categoryId && !c.deleted_at);
  if (data.type !== 'transfer' && !category) return { ok: false, message: 'Wybierz kategorię.' };

  const updatedAt = nowIso();
  const transactionId = crypto.randomUUID();
  const splitId = crypto.randomUUID();
  const amount = data.amount;
  const nextFromBalance = data.type === 'income'
    ? parseFloat(fromAccount.balance) + amount
    : parseFloat(fromAccount.balance) - amount;

  const accounts = [cloneAccountWithBalance(fromAccount, nextFromBalance, updatedAt)];
  if (toAccount) {
    accounts.push(cloneAccountWithBalance(toAccount, parseFloat(toAccount.balance) + amount, updatedAt));
  }

  const sync = await postSyncChanges({
    accounts,
    transactions: [
      {
        id: transactionId,
        type: data.type.toUpperCase(),
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
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zsynchronizować transakcji.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/budget');
  revalidatePath('/categories');
  return { ok: true, id: transactionId, message: 'Transakcja została zapisana.' };
}

function cloneTransactionForDeletion(transaction: SyncTransaction, updatedAt: string) {
  return {
    id: transaction.id,
    type: transaction.type,
    total_amount: transaction.total_amount,
    from_account_id: transaction.from_account_id,
    to_account_id: transaction.to_account_id,
    account_currency: transaction.account_currency,
    transaction_amount: transaction.transaction_amount,
    transaction_currency: transaction.transaction_currency,
    exchange_rate: transaction.exchange_rate,
    to_account_amount: transaction.to_account_amount,
    to_account_currency: transaction.to_account_currency,
    recurring_transaction_id: transaction.recurring_transaction_id,
    date_time: transaction.date_time,
    notes: transaction.notes,
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
    deleted_at: updatedAt,
    version: transaction.version,
  };
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

function cloneTransactionForUpdate(
  transaction: SyncTransaction,
  data: z.infer<typeof transactionInputSchema>,
  fromAccount: SyncAccount,
  toAccount: SyncAccount | null,
  updatedAt: string
) {
  const amount = money(data.amount);

  return {
    id: transaction.id,
    type: data.type.toUpperCase(),
    total_amount: amount,
    from_account_id: fromAccount.id,
    to_account_id: toAccount?.id ?? null,
    account_currency: fromAccount.currency,
    transaction_amount: amount,
    transaction_currency: fromAccount.currency,
    exchange_rate: 1,
    to_account_amount: toAccount ? amount : null,
    to_account_currency: toAccount?.currency ?? null,
    recurring_transaction_id: transaction.recurring_transaction_id,
    date_time: dateToNoonUtc(data.date),
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

export async function updateTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane transakcji.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const transaction = changes.transactions.find(t => t.id === data.id && !t.deleted_at);
  if (!transaction) return { ok: false, message: 'Nie znaleziono transakcji.' };

  const fromAccount = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!fromAccount) return { ok: false, message: 'Wybierz aktywne konto.' };

  const toAccount = data.type === 'transfer'
    ? changes.accounts.find(a => a.id === data.toAccountId && !a.deleted_at && a.is_active) ?? null
    : null;
  if (data.type === 'transfer' && !toAccount) return { ok: false, message: 'Wybierz konto docelowe.' };
  if (data.type === 'transfer' && toAccount?.id === fromAccount.id) {
    return { ok: false, message: 'Konta transferu muszą być różne.' };
  }

  const category = data.type === 'transfer'
    ? null
    : changes.categories.find(c => c.id === data.categoryId && !c.deleted_at);
  if (data.type !== 'transfer' && !category) return { ok: false, message: 'Wybierz kategorię.' };

  const updatedAt = nowIso();
  const accountBalances = new Map<string, number>();
  const getBalance = (accountId: string) => {
    if (accountBalances.has(accountId)) return accountBalances.get(accountId)!;
    const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at);
    if (!account) return null;
    const balance = parseFloat(account.balance);
    accountBalances.set(accountId, balance);
    return balance;
  };
  const addBalance = (accountId: string, delta: number) => {
    const current = getBalance(accountId);
    if (current === null) return false;
    accountBalances.set(accountId, current + delta);
    return true;
  };

  const previousAmount = parseFloat(transaction.total_amount);
  if (transaction.type === 'INCOME') {
    if (!addBalance(transaction.from_account_id, -previousAmount)) return { ok: false, message: 'Nie znaleziono konta transakcji.' };
  } else {
    if (!addBalance(transaction.from_account_id, previousAmount)) return { ok: false, message: 'Nie znaleziono konta transakcji.' };
    if (transaction.type === 'TRANSFER' && transaction.to_account_id && !addBalance(transaction.to_account_id, -previousAmount)) {
      return { ok: false, message: 'Nie znaleziono konta docelowego transferu.' };
    }
  }

  if (data.type === 'income') {
    if (!addBalance(fromAccount.id, data.amount)) return { ok: false, message: 'Nie znaleziono konta transakcji.' };
  } else {
    if (!addBalance(fromAccount.id, -data.amount)) return { ok: false, message: 'Nie znaleziono konta transakcji.' };
    if (data.type === 'transfer' && toAccount && !addBalance(toAccount.id, data.amount)) {
      return { ok: false, message: 'Nie znaleziono konta docelowego transferu.' };
    }
  }

  const accounts = Array.from(accountBalances.entries()).map(([accountId, balance]) => {
    const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at)!;
    return cloneAccountWithBalance(account, balance, updatedAt);
  });
  const existingSplits = changes.transaction_splits.filter(split => split.transaction_id === transaction.id && !split.deleted_at);
  const transactionSplits = data.type === 'transfer'
    ? existingSplits.map(split => cloneSplitForDeletion(split, updatedAt))
    : [
        splitPayload(existingSplits[0], transaction.id, category!.id, data.amount, data.note || '', updatedAt),
        ...existingSplits.slice(1).map(split => cloneSplitForDeletion(split, updatedAt)),
      ];

  const sync = await postSyncChanges({
    accounts,
    transactions: [cloneTransactionForUpdate(transaction, data, fromAccount, toAccount, updatedAt)],
    transaction_splits: transactionSplits,
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zaktualizować transakcji.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/budget');
  revalidatePath('/categories');
  return { ok: true, id: transaction.id, message: 'Transakcja została zaktualizowana.' };
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionResult> {
  return deleteTransactionsAction([transactionId]);
}

export async function deleteTransactionsAction(transactionIds: string[]): Promise<ActionResult> {
  const ids = Array.from(new Set(transactionIds.filter(Boolean)));
  if (ids.length === 0) return { ok: false, message: 'Wybierz transakcje do usunięcia.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const transactions = ids.map(id => changes.transactions.find(t => t.id === id && !t.deleted_at));
  if (transactions.some(transaction => !transaction)) return { ok: false, message: 'Nie znaleziono części transakcji.' };

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

  for (const transaction of transactions as SyncTransaction[]) {
    const amount = parseFloat(transaction.total_amount);
    const fromBalance = getAccountBalance(transaction.from_account_id);
    if (fromBalance === null) return { ok: false, message: 'Nie znaleziono konta transakcji.' };

    accountBalances.set(
      transaction.from_account_id,
      transaction.type === 'INCOME' ? fromBalance - amount : fromBalance + amount
    );

    if (transaction.type === 'TRANSFER' && transaction.to_account_id) {
      const toBalance = getAccountBalance(transaction.to_account_id);
      if (toBalance === null) return { ok: false, message: 'Nie znaleziono konta docelowego transferu.' };
      accountBalances.set(transaction.to_account_id, toBalance - amount);
    }
  }

  const accounts = Array.from(accountBalances.entries()).map(([accountId, balance]) => {
    const account = changes.accounts.find(a => a.id === accountId && !a.deleted_at)!;
    return cloneAccountWithBalance(account, balance, updatedAt);
  });
  const selectedIdSet = new Set(ids);
  const sync = await postSyncChanges({
    accounts,
    transactions: (transactions as SyncTransaction[]).map(transaction => cloneTransactionForDeletion(transaction, updatedAt)),
    transaction_splits: changes.transaction_splits
      .filter(split => split.transaction_id && selectedIdSet.has(split.transaction_id) && !split.deleted_at)
      .map(split => cloneSplitForDeletion(split, updatedAt)),
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się usunąć transakcji.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/transactions');
  revalidatePath('/');
  return {
    ok: true,
    message: ids.length === 1 ? 'Transakcja została usunięta.' : `Usunięto transakcje: ${ids.length}.`,
  };
}

export async function createSettlementAction(input: unknown): Promise<ActionResult> {
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane rozliczenia.' };
  }

  const data = parsed.data;
  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const account = changes.accounts.find(a => a.id === data.accountId && !a.deleted_at && a.is_active);
  if (!account) return { ok: false, message: 'Wybierz aktywne konto.' };

  const updatedAt = nowIso();
  const transactionId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();
  const transactionType = data.direction === 'LENT' ? 'EXPENSE' : 'INCOME';
  const balanceDelta = data.direction === 'LENT' ? -data.amount : data.amount;
  const sync = await postSyncChanges({
    accounts: [cloneAccountWithBalance(account, parseFloat(account.balance) + balanceDelta, updatedAt)],
    transactions: [
      ledgerTransactionPayload({
        id: transactionId,
        type: transactionType,
        amount: data.amount,
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
        total_amount: money(data.amount),
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
  });

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

  const repaid = (changes.settlement_payments ?? [])
    .filter(payment => payment.settlement_id === settlement.id && !payment.deleted_at)
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const remaining = Math.max(parseFloat(settlement.total_amount) - repaid, 0);
  const cappedAmount = Math.min(amount, remaining);
  if (cappedAmount <= 0) return { ok: false, message: 'Rozliczenie nie ma pozostałej kwoty.' };

  const updatedAt = nowIso();
  const transactionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const transactionType = settlement.direction === 'LENT' ? 'INCOME' : 'EXPENSE';
  const balanceDelta = settlement.direction === 'LENT' ? cappedAmount : -cappedAmount;
  const isFullyPaid = cappedAmount >= remaining;
  const sync = await postSyncChanges({
    accounts: [cloneAccountWithBalance(account, parseFloat(account.balance) + balanceDelta, updatedAt)],
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
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać wpłaty.';
  if (failure) return { ok: false, message: failure };

  revalidateFinancePaths();
  return { ok: true, id: paymentId, message: isFullyPaid ? 'Rozliczenie zostało zamknięte.' : 'Wpłata została zapisana.' };
}

export async function addSettlementPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = settlementPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Niepoprawne dane wpłaty.' };
  }

  return addSettlementPayment({
    ...parsed.data,
    ledgerNotePrefix: 'Spłata rozliczenia:',
  });
}

export async function settleSettlementAction(input: unknown): Promise<ActionResult> {
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
    });
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

const budgetInputSchema = z.object({
  amount: z.coerce.number().min(0),
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

export async function upsertOverallBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Podaj poprawną kwotę budżetu.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const existing = changes.overall_budgets.find(b => !b.deleted_at);
  if (!existing && parsed.data.amount <= 0) return { ok: true, message: 'Budżet jest wyłączony.' };

  const updatedAt = nowIso();
  const sync = await postSyncChanges({
    overall_budgets: [overallBudgetPayload(existing, parsed.data.amount, updatedAt)],
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać budżetu.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/budget');
  revalidatePath('/');
  return { ok: true, message: parsed.data.amount > 0 ? 'Budżet ogólny został zapisany.' : 'Budżet ogólny został wyłączony.' };
}

const categoryBudgetInputSchema = budgetInputSchema.extend({
  categoryId: z.string().min(1),
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

export async function upsertCategoryBudgetAction(input: unknown): Promise<ActionResult> {
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
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać budżetu kategorii.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/budget');
  revalidatePath('/categories');
  revalidatePath('/');
  return { ok: true, message: parsed.data.amount > 0 ? 'Budżet kategorii został zapisany.' : 'Budżet kategorii został wyłączony.' };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pl-PL');
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
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  };
}

function importedCategoryPayload(name: string, type: 'EXPENSE' | 'INCOME', sortOrder: number, updatedAt: string) {
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
    parent_category_id: null,
    updated_at: updatedAt,
    deleted_at: null,
    version: 1,
  };
}

export async function confirmImportAnalysisAction(input: unknown): Promise<ActionResult> {
  const parsed = importAnalysisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Niepoprawny podgląd importu.' };
  if (parsed.data.transactions.length === 0) return { ok: false, message: 'Plik nie zawiera transakcji do importu.' };

  const changes = await getServerChanges();
  if (!changes) return { ok: false, message: 'Nie udało się pobrać aktualnych danych.' };

  const updatedAt = nowIso();
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
  const categoriesToSync = new Map<string, ReturnType<typeof importedCategoryPayload>>();
  let maxAccountSort = Math.max(0, ...changes.accounts.map(account => account.sort_order));
  let maxCategorySort = Math.max(0, ...changes.categories.map(category => category.sort_order));

  const resolveAccount = (name: string, currency: string) => {
    const normalized = normalizeName(name || 'Import');
    const importedBalance = importedBalanceByName.get(normalized);
    const existing = accountByName.get(normalized);
    if (existing) {
      if (importedBalance !== undefined && importedBalance !== null) {
        fixedBalanceByAccountId.set(existing.id, importedBalance);
        balanceByAccountId.set(existing.id, importedBalance);
      } else if (!balanceByAccountId.has(existing.id)) {
        balanceByAccountId.set(existing.id, parseFloat(existing.balance));
      }
      return existing;
    }

    const account = importedAccountPayload(name || 'Import', importedBalance ?? 0, currency, ++maxAccountSort, updatedAt);
    accountByName.set(normalized, account);
    balanceByAccountId.set(account.id, parseFloat(account.balance));
    if (importedBalance !== undefined && importedBalance !== null) fixedBalanceByAccountId.set(account.id, importedBalance);
    accountsToSync.set(account.id, account);
    return account;
  };

  const resolveCategory = (name: string, type: 'EXPENSE' | 'INCOME') => {
    const normalized = normalizeName(name || 'Import');
    const existing = categoryByName.get(normalized);
    if (existing) return existing;

    const category = importedCategoryPayload(name || 'Import', type, ++maxCategorySort, updatedAt);
    categoryByName.set(normalized, category);
    categoriesToSync.set(category.id, category);
    return category;
  };

  const transactions: Array<Record<string, unknown>> = [];
  const transactionSplits: Array<Record<string, unknown>> = [];

  for (const imported of parsed.data.transactions) {
    const fromAccount = resolveAccount(imported.from_account, imported.currency);
    const toAccount = imported.type === 'TRANSFER'
      ? resolveAccount(imported.to_account || 'Transfer', imported.currency2 || imported.currency)
      : null;
    const category = imported.type === 'TRANSFER'
      ? null
      : resolveCategory(imported.to_category || (imported.type === 'INCOME' ? 'Przychody z importu' : 'Wydatki z importu'), imported.type);

    const transactionId = crypto.randomUUID();
    const amount = imported.amount;

    const fromBalance = balanceByAccountId.get(fromAccount.id) ?? parseFloat(fromAccount.balance);
    if (!fixedBalanceByAccountId.has(fromAccount.id) && imported.type === 'INCOME') balanceByAccountId.set(fromAccount.id, fromBalance + amount);
    if (!fixedBalanceByAccountId.has(fromAccount.id) && imported.type === 'EXPENSE') balanceByAccountId.set(fromAccount.id, fromBalance - amount);
    if (imported.type === 'TRANSFER' && toAccount) {
      if (!fixedBalanceByAccountId.has(fromAccount.id)) balanceByAccountId.set(fromAccount.id, fromBalance - amount);
      const toBalance = balanceByAccountId.get(toAccount.id) ?? parseFloat(toAccount.balance);
      if (!fixedBalanceByAccountId.has(toAccount.id)) balanceByAccountId.set(toAccount.id, toBalance + (imported.amount2 ?? amount));
    }

    transactions.push({
      id: transactionId,
      type: imported.type,
      total_amount: money(amount),
      from_account_id: fromAccount.id,
      to_account_id: toAccount?.id ?? null,
      account_currency: fromAccount.currency,
      transaction_amount: money(amount),
      transaction_currency: imported.currency,
      exchange_rate: null,
      to_account_amount: toAccount ? money(imported.amount2 ?? amount) : null,
      to_account_currency: toAccount?.currency ?? null,
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
        id: crypto.randomUUID(),
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

  for (const [accountId, balance] of balanceByAccountId) {
    const account = accountByName.get(normalizeName(accountsToSync.get(accountId)?.name ?? changes.accounts.find(item => item.id === accountId)?.name ?? ''));
    const existing = changes.accounts.find(item => item.id === accountId);
    const source = existing ?? account;
    if (!source) continue;
    accountsToSync.set(accountId, cloneAccountWithBalance(source, balance, updatedAt));
  }

  const sync = await postSyncChanges({
    accounts: Array.from(accountsToSync.values()),
    categories: Array.from(categoriesToSync.values()),
    transactions,
    transaction_splits: transactionSplits,
  });

  const failure = sync ? syncFailureMessage(sync.errors, sync.conflicts) : 'Nie udało się zapisać importu.';
  if (failure) return { ok: false, message: failure };

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/import-export');
  return { ok: true, message: `Zaimportowano transakcje: ${parsed.data.transactions.length}.` };
}
