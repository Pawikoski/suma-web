import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchSync: vi.fn(),
  postSyncChanges: vi.fn(),
}));

import { fetchSync, postSyncChanges } from '@/lib/api';
import { createInvestmentHoldingAction, tradeInvestmentHoldingAction } from './sync';

const mockedFetchSync = vi.mocked(fetchSync);
const mockedPostSyncChanges = vi.mocked(postSyncChanges);

const baseChange = {
  updated_at: '2026-05-10T10:00:00Z',
  deleted_at: null,
  version: 1,
};

function investmentAccount(balance = '500.00') {
  return {
    ...baseChange,
    id: 'acc-invest',
    name: 'Broker',
    type: 'INVESTMENT',
    category: 'BASIC',
    balance,
    currency: 'PLN',
    sort_order: 1,
    is_default: false,
    is_active: true,
    include_in_net_worth: true,
    icon_name: 'ShowChart',
    icon_bg: '#EDE9FE',
    icon_color: '#8B5CF6',
    notes: null,
    liability_kind: null,
    credit_limit: null,
    statement_day: null,
    payment_due_day: null,
    liability_principal: null,
    liability_monthly_payment: null,
    payment_account_id: null,
    credit_card_last4: null,
    credit_card_theme: null,
  } as const;
}

function holding() {
  return {
    ...baseChange,
    id: 'holding-aapl',
    account_id: 'acc-invest',
    symbol: 'AAPL',
    name: 'Apple',
    investment_type: 'STOCK',
    quantity: 2,
    unit_price: '100.00',
    currency: 'PLN',
    purchase_currency: 'PLN',
    notes: '',
  } as const;
}

describe('investment server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostSyncChanges.mockResolvedValue({
      request_id: 'req-1',
      new_sync_token: '2',
      applied: {},
      conflicts: [],
      errors: [],
      server_changes: { accounts: [], categories: [], transactions: [], transaction_splits: [], category_budgets: [], overall_budgets: [] },
    });
  });

  it('opens a holding without spending free cash', async () => {
    mockedFetchSync.mockResolvedValue({
      request_id: 'req-1',
      new_sync_token: '1',
      applied: {},
      conflicts: [],
      errors: [],
      server_changes: {
        accounts: [investmentAccount()],
        investment_holdings: [],
        investment_transactions: [],
        categories: [],
        transactions: [],
        transaction_splits: [],
        category_budgets: [],
        overall_budgets: [],
      },
    });

    const result = await createInvestmentHoldingAction({
      accountId: 'acc-invest',
      symbol: 'aapl',
      name: 'Apple',
      investmentType: 'STOCK',
      quantity: 2,
      unitPrice: 100,
      currency: 'PLN',
      notes: '',
    });

    expect(result.ok).toBe(true);
    expect(mockedPostSyncChanges).toHaveBeenCalledWith(expect.not.objectContaining({ accounts: expect.anything() }));
    expect(mockedPostSyncChanges).toHaveBeenCalledWith(expect.objectContaining({
      investment_holdings: [expect.objectContaining({ symbol: 'AAPL', quantity: 2, unit_price: '100.00' })],
      investment_transactions: [expect.objectContaining({ type: 'BUY', quantity: 2, unit_price: '100.00' })],
    }));
  });

  it('rejects buy trades when free cash is too low', async () => {
    mockedFetchSync.mockResolvedValue({
      request_id: 'req-1',
      new_sync_token: '1',
      applied: {},
      conflicts: [],
      errors: [],
      server_changes: {
        accounts: [investmentAccount('50.00')],
        investment_holdings: [holding()],
        investment_transactions: [],
        categories: [],
        transactions: [],
        transaction_splits: [],
        category_budgets: [],
        overall_budgets: [],
      },
    });

    const result = await tradeInvestmentHoldingAction({
      holdingId: 'holding-aapl',
      type: 'BUY',
      quantity: 1,
      unitPrice: 100,
      notes: '',
    });

    expect(result).toEqual({ ok: false, message: 'Brak wystarczających wolnych środków na tym koncie.' });
    expect(mockedPostSyncChanges).not.toHaveBeenCalled();
  });

  it('rejects trades for non-investment accounts', async () => {
    mockedFetchSync.mockResolvedValue({
      request_id: 'req-1',
      new_sync_token: '1',
      applied: {},
      conflicts: [],
      errors: [],
      server_changes: {
        accounts: [{ ...investmentAccount(), type: 'BANK' }],
        investment_holdings: [holding()],
        investment_transactions: [],
        categories: [],
        transactions: [],
        transaction_splits: [],
        category_budgets: [],
        overall_budgets: [],
      },
    });

    const result = await tradeInvestmentHoldingAction({
      holdingId: 'holding-aapl',
      type: 'SELL',
      quantity: 1,
      unitPrice: 100,
      notes: '',
    });

    expect(result).toEqual({ ok: false, message: 'Nie znaleziono aktywnego konta inwestycyjnego.' });
    expect(mockedPostSyncChanges).not.toHaveBeenCalled();
  });
});
