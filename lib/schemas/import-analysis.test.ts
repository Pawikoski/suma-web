import { describe, expect, it } from 'vitest';
import { importAnalysisSchema } from './import-analysis';

describe('importAnalysisSchema', () => {
  it('validates canonical import analysis payloads', () => {
    const result = importAnalysisSchema.parse({
      source_app: 'Wallet',
      source_format: 'csv',
      confidence: 0.91,
      transactions: [
        {
          date: '2026-05-10',
          type: 'EXPENSE',
          from_account: 'Cash',
          to_category: 'Food',
          to_account: null,
          amount: 42.5,
          currency: 'PLN',
          amount2: null,
          currency2: null,
          notes: 'Lunch',
        },
      ],
      accounts: [{ name: 'Cash', balance: null, currency: 'PLN' }],
    });

    expect(result.transactions[0]).toMatchObject({ type: 'EXPENSE', amount: 42.5 });
  });

  it('rejects unknown transaction types', () => {
    expect(() => importAnalysisSchema.parse({
      source_format: 'csv',
      confidence: 1,
      transactions: [{ date: '2026-05-10', type: 'REFUND', from_account: 'Cash', amount: 42.5, currency: 'PLN' }],
      accounts: [],
    })).toThrow();
  });
});
