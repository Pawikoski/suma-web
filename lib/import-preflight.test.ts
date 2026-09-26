import { expect, it } from 'vitest';
import { importPreflight } from './import-preflight';
import { importAnalysisSchema } from './schemas/import-analysis';
import { syncAccountSchema } from './schemas/sync';

const account = syncAccountSchema.parse({ id: 'a', updated_at: '2026-09-08T12:00:00Z', version: 1,
  name: 'Bank', type: 'BANK', category: 'BASIC', balance: '100.00', currency: 'PLN', sort_order: 1,
  is_default: true, is_active: true, include_in_net_worth: true, notes: null });
const analysis = importAnalysisSchema.parse({ source_format: 'csv', confidence: 1, accounts: [], transactions: [
  { date: '2026-09-08', type: 'EXPENSE', from_account: 'Bank', amount: 10, currency: 'PLN' },
] });

it('rejects inactive account matching instead of creating another account with its name', () => {
  expect(importPreflight(analysis, [{ ...account, is_active: false }])).toContain('nieaktywne');
});

it('rejects ambiguous normalized account names', () => {
  expect(importPreflight(analysis, [account, { ...account, id: 'b', name: ' bank ' }])).toContain('kilka kont');
});

it('allows a genuine account named Unknown Account instead of inferring missing metadata from the label', () => {
  expect(importPreflight({ ...analysis, transactions: [{ ...analysis.transactions[0], from_account: 'Unknown Account' }] }, [])).toBeNull();
});

it.each([0, -10, Infinity, NaN, 0.001, 1.005, Number.MAX_SAFE_INTEGER])('rejects invalid amount %s before graph construction', amount => {
  expect(importAnalysisSchema.safeParse({ ...analysis, transactions: [{ ...analysis.transactions[0], amount }] }).success).toBe(false);
});

it('rejects invalid calendar dates', () => {
  expect(importAnalysisSchema.safeParse({ ...analysis, transactions: [{ ...analysis.transactions[0], date: '2026-02-30' }] }).success).toBe(false);
});
