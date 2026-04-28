import { describe, expect, it } from 'vitest';
import { parseSyncResponse } from './sync';

const baseSyncResponse = {
  request_id: 'req-1',
  new_sync_token: '42',
  server_changes: {
    accounts: [],
    categories: [],
    transactions: [],
    transaction_splits: [],
    category_budgets: [],
    overall_budgets: [],
  },
};

describe('parseSyncResponse', () => {
  it('accepts a valid sync response', () => {
    const result = parseSyncResponse(baseSyncResponse);

    expect(result.request_id).toBe('req-1');
    expect(result.server_changes.transactions).toEqual([]);
  });

  it('rejects transactions with unknown types', () => {
    expect(() => parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        transactions: [
          {
            id: 'tx-1',
            type: 'REFUND',
            total_amount: '12.30',
            from_account_id: 'acc-1',
            to_account_id: null,
            account_currency: 'PLN',
            date_time: '2026-04-28T10:00:00Z',
            notes: null,
            location_name: null,
            location_address: null,
            count_in_summary: true,
            updated_at: '2026-04-28T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    })).toThrow();
  });
});
