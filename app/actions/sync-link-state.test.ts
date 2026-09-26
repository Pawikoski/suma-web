import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchSync: vi.fn(), postSyncChanges: vi.fn() }));
import { fetchSync, postSyncChanges } from '@/lib/api';
import { parseSyncResponse } from '@/lib/schemas/sync';
import { SyncRequestError } from '@/lib/sync-errors';
import { confirmImportAnalysisAction, createTransactionAction, deleteTransactionAction, reconcileSubmissionAction, updateTransactionAction } from './sync';
import { submissionEntityId } from '@/lib/submission-id';

const base = { updated_at: '2026-09-08T09:37:12Z', deleted_at: null, version: 3 };
const account = { ...base, id: 'source', name: 'Bank', type: 'BANK', category: 'BASIC', balance: '100.00',
  currency: 'PLN', sort_order: 0, is_default: true, is_active: true, include_in_net_worth: true, notes: null };
const category = { ...base, id: 'category', name: 'Food', types: ['EXPENSE'], icon_name: '', icon_bg: '#FFFFFF',
  icon_color: '#000000', sort_order: 0, is_default: false, is_system: false };
const transaction = { ...base, id: 'tx', type: 'TRANSFER', total_amount: '13.37', from_account_id: 'source', to_account_id: null,
  account_link_state: 'MISSING_DESTINATION', missing_destination_reason: 'LEGACY',
  account_currency: 'PLN', transaction_amount: '13.37', transaction_currency: 'PLN', exchange_rate: 1,
  to_account_amount: '2.33', to_account_currency: 'EUR', purpose: 'STANDARD',
  date_time: base.updated_at, notes: 'Before', location_name: null, location_address: null, count_in_summary: true };
const blank = { accounts: [], categories: [], transactions: [], transaction_splits: [], category_budgets: [], overall_budgets: [] };
const snapshot = () => parseSyncResponse({ request_id: 'read', new_sync_token: '3', server_changes: {
  ...blank, accounts: [account, { ...account, id: 'destination', name: 'Savings', currency: 'EUR' }], categories: [category], transactions: [transaction],
} });
const input = { id: 'tx', expectedVersion: 3, type: 'transfer', amount: 13.37, date: '2026-09-08', accountId: 'source', toAccountId: null, note: 'After' };
const analysis = { submissionId: 'aaa4f862-ade9-4c69-8b7d-fc4cc43d53b2', submittedAt: '2026-09-26T12:00:00.000Z', source_format: 'csv', confidence: 1, accounts: [], transactions: [{ date: '2026-09-08', type: 'TRANSFER',
  amount: 13.37, currency: 'PLN', from_account: 'Bank', to_account: null, amount2: 2.33, currency2: 'EUR' }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSync).mockResolvedValue(snapshot());
  vi.mocked(postSyncChanges).mockResolvedValue(parseSyncResponse({ request_id: 'write', new_sync_token: '4', server_changes: blank }));
});

it('keeps missing destination, monetary metadata and account balances when editing history notes', async () => {
  expect((await updateTransactionAction(input)).ok).toBe(true);
  const sent = vi.mocked(postSyncChanges).mock.calls[0][0];
  expect(sent).not.toHaveProperty('accounts');
  expect(sent.transactions).toEqual([expect.objectContaining({ ...transaction, notes: 'After', updated_at: expect.any(String) })]);
});

it('allows a note edit for an inactive historical source', async () => {
  const data = snapshot(); data.server_changes.accounts[0].is_active = false;
  vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await updateTransactionAction(input)).ok).toBe(true);
});

it('requires consent before crediting a newly resolved destination', async () => {
  expect((await updateTransactionAction({ ...input, toAccountId: 'destination' })).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('rejects a stale form instead of stamping its content with the latest server version', async () => {
  expect((await updateTransactionAction({ ...input, expectedVersion: 2 })).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('resolves a foreign destination with its preserved amount and clears missing state', async () => {
  expect((await updateTransactionAction({ ...input, toAccountId: 'destination', confirmDestinationBalanceChange: true })).ok).toBe(true);
  expect(vi.mocked(postSyncChanges).mock.calls[0][0]).toMatchObject({ transactions: [{
    account_link_state: 'COMPLETE', missing_destination_reason: null, to_account_id: 'destination',
    to_account_amount: '2.33', to_account_currency: 'EUR', total_amount: '13.37', transaction_currency: 'PLN',
  }] });
});

it('rejects resolving to a currency inconsistent with the retained destination metadata', async () => {
  const data = snapshot(); data.server_changes.accounts[1].currency = 'USD'; vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await updateTransactionAction({ ...input, toAccountId: 'destination', confirmDestinationBalanceChange: true })).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('does not invent a conversion for missing foreign destination amounts', async () => {
  const data = snapshot(); data.server_changes.transactions[0].to_account_amount = null; vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await updateTransactionAction({ ...input, toAccountId: 'destination', confirmDestinationBalanceChange: true })).ok).toBe(false);
});

it('clears the history-only state when changing transfer to expense', async () => {
  expect((await updateTransactionAction({ ...input, type: 'expense', categoryId: 'category' })).ok).toBe(true);
  expect(vi.mocked(postSyncChanges).mock.calls[0][0]).toMatchObject({ transactions: [{
    type: 'EXPENSE', account_link_state: 'COMPLETE', missing_destination_reason: null, to_account_id: null, to_account_amount: null,
  }] });
});

it('keeps split items on a note-only edit', async () => {
  const data = snapshot(); Object.assign(data.server_changes.transactions[0], { type: 'EXPENSE', account_link_state: 'COMPLETE', missing_destination_reason: null });
  data.server_changes.transaction_splits = [1, 2].map(id => ({ ...base, id: String(id), transaction_id: 'tx', category_id: 'category', amount: '6.685', name: 'item', quantity: 2, unit: 'pcs', unit_price: '3.3425' }));
  vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await updateTransactionAction({ ...input, type: 'expense', categoryId: 'category' })).ok).toBe(true);
  expect(vi.mocked(postSyncChanges).mock.calls[0][0].transaction_splits).toEqual([]);
});

it('deletes history by tombstone without dropping metadata or guessing account effects', async () => {
  expect((await deleteTransactionAction('tx')).ok).toBe(true);
  const sent = vi.mocked(postSyncChanges).mock.calls[0][0];
  expect(sent).not.toHaveProperty('accounts');
  expect(sent.transactions).toEqual([expect.objectContaining({ ...transaction, deleted_at: expect.any(String), updated_at: expect.any(String) })]);
});

it('returns the safe actionable HTTP failure through server actions', async () => {
  vi.mocked(postSyncChanges).mockRejectedValue(new SyncRequestError('Zaktualizuj aplikację.', 409, 'sync_client_upgrade_required'));
  expect(await updateTransactionAction(input)).toEqual({ ok: false, message: 'Zaktualizuj aplikację.' });
});

it('does not report a successfully accepted client-wins conflict as a rejected write', async () => {
  vi.mocked(postSyncChanges).mockResolvedValue({ ...snapshot(), conflicts: [{ id: 'tx', model: 'core.Transaction', resolution: 'client_wins' }] });
  expect((await updateTransactionAction(input)).ok).toBe(true);
});

it('blocks the entire import when one source is missing', async () => {
  expect((await confirmImportAnalysisAction({ ...analysis, transactions: [analysis.transactions[0], { ...analysis.transactions[0], from_account: '' }], allow_missing_destination: true })).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('requires explicit consent for importing missing destinations', async () => {
  expect((await confirmImportAnalysisAction(analysis)).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('imports preserved missing destination metadata without creating a fake account', async () => {
  expect((await confirmImportAnalysisAction({ ...analysis, allow_missing_destination: true })).ok).toBe(true);
  const sent = vi.mocked(postSyncChanges).mock.calls[0][0];
  expect(sent.accounts).toEqual([]);
  expect(sent.transactions).toEqual([expect.objectContaining({ account_link_state: 'MISSING_DESTINATION', missing_destination_reason: 'ABSENT_IN_FILE', to_account_id: null, to_account_amount: '2.33', to_account_currency: 'EUR' })]);
});

it.each([
  { from_account: 'Bank', currency: 'USD', to_account: 'Savings' },
  { from_account: 'Bank', currency: 'PLN', to_account: ' bank ' },
  { from_account: 'Bank', currency: 'PLN', to_account: 'Savings', currency2: 'EUR', amount2: null },
])('rejects ambiguous or financially incomplete import before writing: %j', async row => {
  expect((await confirmImportAnalysisAction({ ...analysis, transactions: [{ ...analysis.transactions[0], ...row }] })).ok).toBe(false);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('reports an atomic account creation failure as failed import', async () => {
  vi.mocked(postSyncChanges).mockResolvedValue({ ...snapshot(), errors: [{ model: 'core.Account', error: 'limit_exceeded' }] });
  expect((await confirmImportAnalysisAction({ ...analysis, allow_missing_destination: true, transactions: [{ ...analysis.transactions[0], from_account: 'New bank' }] })).ok).toBe(false);
  expect(postSyncChanges).toHaveBeenCalledTimes(1);
});

it('uses stable entity IDs when the same create draft is retried after an unknown outcome', async () => {
  vi.mocked(postSyncChanges).mockRejectedValueOnce(new SyncRequestError('Lost response', 0, 'outcome_unknown'));
  const draft = { ...input, type: 'expense', categoryId: 'category', submissionId: analysis.submissionId, submittedAt: analysis.submittedAt };
  expect(await createTransactionAction(draft)).toMatchObject({ ok: false, outcomeUnknown: true });
  expect((await createTransactionAction(draft)).ok).toBe(true);
  expect(vi.mocked(postSyncChanges).mock.calls[0][0]).toEqual(vi.mocked(postSyncChanges).mock.calls[1][0]);
});

it('recognizes an already committed creation before issuing another mutation', async () => {
  const data = snapshot(); data.server_changes.transactions[0].id = submissionEntityId(analysis.submissionId, 'transaction:0');
  vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await createTransactionAction({ ...input, type: 'expense', categoryId: 'category', submissionId: analysis.submissionId, submittedAt: analysis.submittedAt })).ok).toBe(true);
  expect(postSyncChanges).not.toHaveBeenCalled();
});

it('keeps imported account and transaction identities stable after a lost response', async () => {
  vi.mocked(postSyncChanges).mockRejectedValueOnce(new SyncRequestError('Lost response', 0, 'outcome_unknown'));
  const draft = { ...analysis, allow_missing_destination: true, transactions: [{ ...analysis.transactions[0], from_account: 'New bank' }] };
  expect(await confirmImportAnalysisAction(draft)).toMatchObject({ ok: false, outcomeUnknown: true });
  expect((await confirmImportAnalysisAction(draft)).ok).toBe(true);
  expect(vi.mocked(postSyncChanges).mock.calls[0][0]).toEqual(vi.mocked(postSyncChanges).mock.calls[1][0]);
});

it('reconciles an applied import instead of importing the rows twice', async () => {
  const data = snapshot(); data.server_changes.transactions[0].id = submissionEntityId(analysis.submissionId, 'transaction:0');
  vi.mocked(fetchSync).mockResolvedValue(data);
  expect((await confirmImportAnalysisAction({ ...analysis, allow_missing_destination: true })).ok).toBe(true);
  expect(postSyncChanges).not.toHaveBeenCalled();
  expect(await reconcileSubmissionAction({ id: analysis.submissionId, count: 1 })).toMatchObject({ ok: true, found: 1, total: 1 });
});

it('refuses to replay a partially found import as a fresh operation', async () => {
  const data = snapshot(); data.server_changes.transactions[0].id = submissionEntityId(analysis.submissionId, 'transaction:0');
  vi.mocked(fetchSync).mockResolvedValue(data);
  expect(await confirmImportAnalysisAction({ ...analysis, transactions: [analysis.transactions[0], analysis.transactions[0]], allow_missing_destination: true })).toMatchObject({ ok: false, outcomeUnknown: true });
  expect(postSyncChanges).not.toHaveBeenCalled();
});
