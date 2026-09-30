import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchSync: vi.fn(), postSyncChanges: vi.fn() }));
import { fetchSync, postSyncChanges } from '@/lib/api';
import { parseSyncResponse } from '@/lib/schemas/sync';
import { LOCKED_CATEGORY_MESSAGE } from '@/lib/category-lock';
import { createTransactionAction, updateTransactionAction } from './sync';

// N-14: a Free-plan locked category keeps its history but cannot be picked for new records.
const time = '2026-09-08T09:37:12Z';
const base = { updated_at: time, deleted_at: null, version: 3 };
const account = { ...base, id: 'account', name: 'Bank', type: 'BANK', category: 'BASIC', balance: '20.00',
  currency: 'PLN', sort_order: 0, is_default: true, is_active: true, include_in_net_worth: true, notes: null };
const category = (id: string, isLocked: boolean) => ({ ...base, id, name: id, types: ['EXPENSE'], icon_name: '',
  icon_bg: '#FFFFFF', icon_color: '#000000', sort_order: 0, is_default: false, is_system: false, is_locked: isLocked });
const transaction = { ...base, id: 'tx', type: 'EXPENSE', total_amount: '4.00', from_account_id: 'account',
  to_account_id: null, account_currency: 'PLN', date_time: time, notes: 'Before', location_name: null,
  location_address: null, count_in_summary: true };
const split = { ...base, id: 'split', transaction_id: 'tx', category_id: 'pets', amount: '4.00', notes: '' };
const snapshot = () => parseSyncResponse({ request_id: 'read', new_sync_token: '3', server_changes: {
  accounts: [account], categories: [category('food', false), category('pets', true)], transactions: [transaction],
  transaction_splits: [split], category_budgets: [], overall_budgets: [] } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSync).mockResolvedValue(snapshot());
  vi.mocked(postSyncChanges).mockResolvedValue(parseSyncResponse({ request_id: 'write', new_sync_token: '4',
    server_changes: { accounts: [], categories: [], transactions: [], transaction_splits: [], category_budgets: [], overall_budgets: [] } }));
});

it('rejects a locked category for a new transaction', async () => {
  const result = await createTransactionAction({ type: 'expense', amount: 5, date: '2026-09-08', accountId: 'account',
    categoryId: 'pets', note: '', submissionId: crypto.randomUUID(), submittedAt: time });

  expect(result).toEqual({ ok: false, message: LOCKED_CATEGORY_MESSAGE });
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('keeps a locked category on an edited transaction', async () => {
  const result = await updateTransactionAction({ id: 'tx', expectedVersion: 3, type: 'expense', amount: 4,
    date: '2026-09-08', accountId: 'account', categoryId: 'pets', note: 'After' });

  expect(result.ok).toBe(true);
});

it('does not move an edited transaction to a locked category', async () => {
  vi.mocked(fetchSync).mockResolvedValue(parseSyncResponse({ request_id: 'read', new_sync_token: '3', server_changes: {
    accounts: [account], categories: [category('food', false), category('pets', true)], transactions: [transaction],
    transaction_splits: [{ ...split, category_id: 'food' }], category_budgets: [], overall_budgets: [] } }));

  const result = await updateTransactionAction({ id: 'tx', expectedVersion: 3, type: 'expense', amount: 4,
    date: '2026-09-08', accountId: 'account', categoryId: 'pets', note: 'After' });

  expect(result).toEqual({ ok: false, message: LOCKED_CATEGORY_MESSAGE });
});
