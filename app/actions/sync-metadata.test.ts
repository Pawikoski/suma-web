import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchSync: vi.fn(), postSyncChanges: vi.fn() }));
import { fetchSync, postSyncChanges } from '@/lib/api';
import { parseSyncResponse } from '@/lib/schemas/sync';
import { updateTransactionAction } from './sync';

const time = '2026-09-08T09:37:12Z';
const base = { updated_at: time, deleted_at: null, version: 3 };
const account = { ...base, id: 'account', parent_id: 'parent', name: 'Bank', type: 'BANK', category: 'BASIC',
  balance: '20.00', balance_anchor: '24.00', currency: 'PLN', sort_order: 0, is_default: true, is_active: true,
  include_in_net_worth: true, notes: null };
const category = { ...base, id: 'category', name: 'Food', types: ['EXPENSE'], icon_name: '', icon_bg: '#FFFFFF',
  icon_color: '#000000', sort_order: 0, is_default: false, is_system: false, essentiality: 'ESSENTIAL', classification_source: 'MANUAL' };
const transaction = { ...base, id: 'tx', type: 'EXPENSE', total_amount: '4.00', from_account_id: 'account', to_account_id: null,
  account_currency: 'PLN', transaction_amount: '1.00', transaction_currency: 'EUR', exchange_rate: 4,
  date_time: time, notes: 'Before', location_name: null, location_address: null, count_in_summary: true,
  recurring_transaction_id: 'recurring', recurring_occurrence_date: '2026-09-08', recurring_match_decision: 'MANUAL',
  merchant_id: 'merchant', merchant_name: 'Shop', merchant_key: 'shop', merchant_classification_source: 'MANUAL',
  purpose: 'ASSET_PURCHASE', asset_account_id: 'asset', asset_gross_amount: '4.00', asset_fee_amount: '0.00',
  asset_cost_basis: '4.00', asset_realized_pnl: null, is_refund: false, refund_of_transaction_id: null };
const snapshot = () => parseSyncResponse({ request_id: 'read', new_sync_token: '3', server_changes: {
  accounts: [account], categories: [category], transactions: [transaction], transaction_splits: [], category_budgets: [], overall_budgets: [] } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSync).mockResolvedValue(snapshot());
  vi.mocked(postSyncChanges).mockResolvedValue(parseSyncResponse({ request_id: 'write', new_sync_token: '4', server_changes: { accounts: [], categories: [], transactions: [], transaction_splits: [], category_budgets: [], overall_budgets: [] } }));
});

it('keeps Android metadata and original currency/time when only a note changes', async () => {
  const result = await updateTransactionAction({ id: 'tx', type: 'expense', amount: 4, date: '2026-09-08',
    accountId: 'account', categoryId: 'category', note: 'After' });
  expect(result.ok).toBe(true);
  const sent = vi.mocked(postSyncChanges).mock.calls[0][0];
  expect(sent.transactions).toEqual([expect.objectContaining({ ...transaction, notes: 'After', updated_at: expect.any(String) })]);
  expect(sent.accounts).toEqual([expect.objectContaining({ parent_id: 'parent', balance_anchor: '24.00' })]);
  expect(snapshot().server_changes.categories[0]).toMatchObject({ essentiality: 'ESSENTIAL', classification_source: 'MANUAL' });
});

it('does not invent an exchange rate when changing a foreign transaction amount', async () => {
  const result = await updateTransactionAction({ id: 'tx', type: 'expense', amount: 5, date: '2026-09-08',
    accountId: 'account', categoryId: 'category', note: 'After' });
  expect(result.ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});
