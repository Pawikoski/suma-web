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

  it('validates recurring transactions at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        recurring_transactions: [
          {
            id: 'rec-1',
            from_account_id: 'acc-1',
            to_account_id: null,
            type: 'EXPENSE',
            total_amount: '49.99',
            account_currency: 'PLN',
            frequency: 'MONTHLY',
            interval_value: 1,
            start_date: '2026-05-01',
            end_date: null,
            last_generated_date: null,
            skipped_occurrence_dates: ['2026-06-01'],
            category_splits: [{ category_id: 'cat-1', amount: '49.99' }],
            recurring_category: 'SUBSCRIPTION',
            recurring_category_label: null,
            is_active: true,
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.recurring_transactions[0]).toMatchObject({
      id: 'rec-1',
      frequency: 'MONTHLY',
      skipped_occurrence_dates: ['2026-06-01'],
    });
  });

  it('validates settlements at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        settlements: [
          {
            id: 'settlement-1',
            direction: 'LENT',
            account_id: 'acc-1',
            transaction_id: null,
            counterparty_name: 'Marek',
            counterparty_email: 'marek@example.com',
            total_amount: '100.00',
            currency: 'PLN',
            note: null,
            due_date: '2026-05-20T12:00:00Z',
            reminder_days_before: '1',
            status: 'ACTIVE',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
        settlement_payments: [
          {
            id: 'payment-1',
            settlement_id: 'settlement-1',
            account_id: 'acc-1',
            transaction_id: null,
            amount: '25.00',
            paid_at: '2026-05-10T10:00:00Z',
            note: null,
            updated_at: '2026-05-10T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.settlements[0]).toMatchObject({ direction: 'LENT', total_amount: '100.00' });
    expect(result.server_changes.settlement_payments[0]).toMatchObject({ amount: '25.00' });
  });

  it('validates account interest at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        account_interest: [
          {
            id: 'interest-1',
            account_id: 'acc-1',
            annual_rate_percent: 6.5,
            base_amount: null,
            start_date: '2026-05-01T00:00:00Z',
            end_date: '2026-08-01T00:00:00Z',
            tax_rate_percent: 19,
            after_maturity_action: 'DISABLE',
            target_account_id: null,
            is_active: true,
            interest_category_id: null,
            monthly_payment: null,
            original_loan_amount: null,
            updated_at: '2026-05-01T00:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.account_interest[0]).toMatchObject({
      annual_rate_percent: 6.5,
      after_maturity_action: 'DISABLE',
    });
  });

  it('validates investment holdings and transactions at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        investment_holdings: [
          {
            id: 'holding-1',
            account_id: 'acc-invest',
            symbol: 'AAPL',
            name: 'Apple',
            investment_type: 'STOCK',
            quantity: 0,
            unit_price: '100.00',
            currency: 'PLN',
            purchase_currency: 'PLN',
            notes: '',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
        investment_transactions: [
          {
            id: 'investment-tx-1',
            holding_id: 'holding-1',
            type: 'BUY',
            quantity: 2,
            unit_price: '100.00',
            currency: 'PLN',
            date: '2026-05-01T10:00:00Z',
            notes: '',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.investment_holdings[0]).toMatchObject({ id: 'holding-1', quantity: 0 });
    expect(result.server_changes.investment_transactions[0]).toMatchObject({ id: 'investment-tx-1', quantity: 2 });
  });

  it('rejects invalid investment amounts at the sync boundary', () => {
    expect(() => parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        investment_holdings: [
          {
            id: 'holding-1',
            account_id: 'acc-invest',
            symbol: 'AAPL',
            name: 'Apple',
            investment_type: 'STOCK',
            quantity: -1,
            unit_price: '100.00',
            currency: 'PLN',
            purchase_currency: 'PLN',
            notes: '',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    })).toThrow();

    expect(() => parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        investment_transactions: [
          {
            id: 'investment-tx-1',
            holding_id: 'holding-1',
            type: 'BUY',
            quantity: 2,
            unit_price: '0.00',
            currency: 'PLN',
            date: '2026-05-01T10:00:00Z',
            notes: '',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    })).toThrow();
  });

  it('validates transaction photos at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        transaction_photos: [
          {
            id: 'photo-1',
            transaction_id: 'tx-1',
            mime_type: 'image/jpeg',
            content_hash: 'hash-1',
            image_base64: 'ZmFrZQ==',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.transaction_photos[0]).toMatchObject({
      id: 'photo-1',
      mime_type: 'image/jpeg',
      image_base64: 'ZmFrZQ==',
    });
  });

  it('validates account budget and override models at the sync boundary', () => {
    const result = parseSyncResponse({
      ...baseSyncResponse,
      server_changes: {
        ...baseSyncResponse.server_changes,
        account_budgets: [
          {
            id: 'account-budget-1',
            account_id: 'acc-1',
            budget_amount: '250.00',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
        account_budget_overrides: [
          {
            id: 'account-budget-override-1',
            account_id: 'acc-1',
            year_month: '2026-05',
            budget_amount: '300.00',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
        overall_budget_overrides: [
          {
            id: 'overall-override-1',
            year_month: '2026-05',
            budget_amount: '650.00',
            updated_at: '2026-05-01T10:00:00Z',
            deleted_at: null,
            version: 1,
          },
        ],
      },
    });

    expect(result.server_changes.account_budgets[0]).toMatchObject({ budget_amount: '250.00' });
    expect(result.server_changes.account_budget_overrides[0]).toMatchObject({ year_month: '2026-05' });
    expect(result.server_changes.overall_budget_overrides[0]).toMatchObject({ budget_amount: '650.00' });
  });
});
