import { describe, expect, it } from 'vitest';
import { mapSyncData } from './mappers';
import { SyncServerChanges } from './api-types';

const baseChange = {
  updated_at: '2026-05-10T10:00:00Z',
  deleted_at: null,
  version: 1,
};

function syncFixture(): SyncServerChanges {
  return {
    accounts: [
      {
        ...baseChange,
        id: 'acc-cash',
        name: 'Cash',
        type: 'CASH',
        category: 'BASIC',
        balance: '100.00',
        currency: 'PLN',
        sort_order: 1,
        is_default: true,
        is_active: true,
        include_in_net_worth: true,
        icon_name: 'wallet',
        icon_bg: '#fff',
        icon_color: '#111',
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
      },
    ],
    categories: [
      {
        ...baseChange,
        id: 'cat-food',
        name: 'Food',
        types: ['EXPENSE'],
        icon_name: 'shopping_cart',
        icon_bg: '#eee',
        icon_color: '#123456',
        sort_order: 1,
        is_default: false,
        is_system: false,
        parent_category_id: null,
      },
    ],
    transactions: [
      {
        ...baseChange,
        id: 'tx-current',
        type: 'EXPENSE',
        total_amount: '25.50',
        from_account_id: 'acc-cash',
        to_account_id: null,
        account_currency: 'PLN',
        transaction_amount: '25.50',
        transaction_currency: 'PLN',
        exchange_rate: 1,
        to_account_amount: null,
        to_account_currency: null,
        recurring_transaction_id: null,
        date_time: '2026-05-09T12:00:00Z',
        notes: 'Lunch',
        location_lat: null,
        location_lng: null,
        location_name: null,
        location_address: null,
        is_from_receipt: false,
        is_from_notification_parser: true,
        review_status: 'PENDING',
        parser_notification_key: 'bank-app:abc',
        count_in_summary: true,
        summary_amount: null,
      },
      {
        ...baseChange,
        id: 'tx-old',
        type: 'INCOME',
        total_amount: '50.00',
        from_account_id: 'acc-cash',
        to_account_id: null,
        account_currency: 'PLN',
        transaction_amount: '50.00',
        transaction_currency: 'PLN',
        exchange_rate: 1,
        to_account_amount: null,
        to_account_currency: null,
        recurring_transaction_id: null,
        date_time: '2026-04-09T12:00:00Z',
        notes: null,
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
      },
    ],
    transaction_splits: [
      {
        ...baseChange,
        id: 'split-current',
        transaction_id: 'tx-current',
        category_id: 'cat-food',
        amount: '25.50',
        name: '',
        quantity: 1,
        unit: 'pcs',
        unit_price: null,
      },
    ],
    transaction_photos: [
      {
        ...baseChange,
        id: 'photo-current',
        transaction_id: 'tx-current',
        mime_type: 'image/jpeg',
        content_hash: 'hash-1',
        image_base64: 'ZmFrZQ==',
      },
    ],
    account_budgets: [
      {
        ...baseChange,
        id: 'account-budget-cash',
        account_id: 'acc-cash',
        budget_amount: '250.00',
      },
    ],
    category_budgets: [
      {
        ...baseChange,
        id: 'budget-food',
        category_id: 'cat-food',
        type: 'EXPENSE_BUDGET',
        budget_amount: '100.00',
      },
    ],
    overall_budgets: [
      {
        ...baseChange,
        id: 'overall',
        budget_amount: '500.00',
      },
    ],
    account_budget_overrides: [
      {
        ...baseChange,
        id: 'account-budget-override-cash',
        account_id: 'acc-cash',
        year_month: '2026-05',
        budget_amount: '300.00',
      },
    ],
    overall_budget_overrides: [
      {
        ...baseChange,
        id: 'overall-override',
        year_month: '2026-05',
        budget_amount: '650.00',
      },
    ],
    recurring_transactions: [
      {
        ...baseChange,
        id: 'rec-rent',
        from_account_id: 'acc-cash',
        to_account_id: null,
        type: 'EXPENSE',
        total_amount: '1200.00',
        account_currency: 'PLN',
        transaction_amount: '1200.00',
        transaction_currency: 'PLN',
        exchange_rate: 1,
        to_account_amount: null,
        to_account_currency: null,
        notes: 'Rent',
        location_lat: null,
        location_lng: null,
        location_name: null,
        location_address: null,
        count_in_summary: true,
        summary_amount: null,
        frequency: 'MONTHLY',
        interval_value: 1,
        start_date: '2026-05-01',
        end_date: null,
        last_generated_date: '2026-05-01',
        skipped_occurrence_dates: [],
        category_splits: [{ category_id: 'cat-food', amount: '1200.00' }],
        recurring_category: 'RENTAL',
        recurring_category_label: null,
        is_active: true,
      },
    ],
    account_interest: [
      {
        ...baseChange,
        id: 'interest-cash',
        account_id: 'acc-cash',
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
      },
    ],
    settlements: [
      {
        ...baseChange,
        id: 'settlement-1',
        direction: 'LENT',
        account_id: 'acc-cash',
        transaction_id: null,
        counterparty_name: 'Marek',
        counterparty_email: 'marek@example.com',
        total_amount: '100.00',
        currency: 'PLN',
        note: 'Dinner',
        due_date: '2026-05-20T12:00:00Z',
        reminder_days_before: '1',
        status: 'ACTIVE',
      },
    ],
    settlement_payments: [
      {
        ...baseChange,
        id: 'settlement-payment-1',
        settlement_id: 'settlement-1',
        account_id: 'acc-cash',
        transaction_id: null,
        amount: '30.00',
        paid_at: '2026-05-11T12:00:00Z',
        note: null,
      },
    ],
  };
}

describe('mapSyncData', () => {
  it('uses the user preference as the base currency before account fallbacks', () => {
    const data = mapSyncData(syncFixture(), '2026-05', 'eur');

    expect(data.baseCurrency).toBe('EUR');
  });

  it('keeps all transactions while deriving the selected month view', () => {
    const data = mapSyncData(syncFixture(), '2026-05');

    expect(data.transactions.map(tx => tx.id)).toEqual(['tx-current']);
    expect(data.allTransactions.map(tx => tx.id)).toEqual(['tx-current', 'tx-old']);
    expect(data.transactions[0].photos).toEqual([
      { id: 'photo-current', mimeType: 'image/jpeg', contentHash: 'hash-1', imageBase64: 'ZmFrZQ==' },
    ]);
    expect(data.transactions[0]).toMatchObject({
      isFromNotificationParser: true,
      reviewStatus: 'PENDING',
      parserNotificationKey: 'bank-app:abc',
    });
  });

  it('maps category budget and month spending from splits', () => {
    const data = mapSyncData(syncFixture(), '2026-05');

    expect(data.categories[0]).toMatchObject({
      id: 'cat-food',
      spent: 25.5,
      budget: 100,
      budgetId: 'budget-food',
      txCount: 1,
    });
    expect(data.overallBudgetRecord).toMatchObject({ id: 'overall-override', amount: 650 });
    expect(data.accountBudgets[0]).toMatchObject({
      id: 'account-budget-cash',
      accountName: 'Cash',
      amount: 300,
      baseAmount: 250,
      overrideId: 'account-budget-override-cash',
    });
  });

  it('maps recurring transactions from the sync contract', () => {
    const data = mapSyncData(syncFixture(), '2026-05');

    expect(data.recurringTransactions[0]).toMatchObject({
      id: 'rec-rent',
      amount: 1200,
      fromAccountName: 'Cash',
      frequency: 'MONTHLY',
      recurringCategory: 'RENTAL',
      categorySplits: [{ categoryId: 'cat-food', amount: 1200 }],
    });
  });

  it('maps settlement summaries with repaid and remaining amounts', () => {
    const data = mapSyncData(syncFixture(), '2026-05');

    expect(data.settlements[0]).toMatchObject({
      id: 'settlement-1',
      counterpartyName: 'Marek',
      accountName: 'Cash',
      totalAmount: 100,
      repaidAmount: 30,
      remainingAmount: 70,
      payments: [{ amount: 30, accountName: 'Cash' }],
    });
  });

  it('maps account interest settings from the sync contract', () => {
    const data = mapSyncData(syncFixture(), '2026-05');

    expect(data.accountInterest[0]).toMatchObject({
      id: 'interest-cash',
      accountName: 'Cash',
      annualRatePercent: 6.5,
      effectiveBaseAmount: 100,
      startDate: '2026-05-01',
      endDate: '2026-08-01',
    });
  });

  it('keeps investment holdings only for active investment asset accounts', () => {
    const fixture = syncFixture();
    fixture.accounts.push(
      {
        ...baseChange,
        id: 'acc-invest',
        name: 'Broker',
        type: 'INVESTMENT',
        category: 'BASIC',
        balance: '500.00',
        currency: 'PLN',
        sort_order: 2,
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
      }
    );
    fixture.investment_holdings = [
      {
        ...baseChange,
        id: 'holding-valid',
        account_id: 'acc-invest',
        symbol: 'AAPL',
        name: 'Apple',
        investment_type: 'STOCK',
        quantity: 2,
        unit_price: '100.00',
        currency: 'PLN',
        purchase_currency: 'PLN',
        notes: '',
      },
      {
        ...baseChange,
        id: 'holding-cash',
        account_id: 'acc-cash',
        symbol: 'MSFT',
        name: 'Microsoft',
        investment_type: 'STOCK',
        quantity: 1,
        unit_price: '80.00',
        currency: 'PLN',
        purchase_currency: 'PLN',
        notes: '',
      },
    ];
    fixture.investment_transactions = [
      {
        ...baseChange,
        id: 'investment-tx-valid',
        holding_id: 'holding-valid',
        type: 'BUY',
        quantity: 2,
        unit_price: '100.00',
        currency: 'PLN',
        date: '2026-05-10T10:00:00Z',
        notes: '',
      },
    ];

    const data = mapSyncData(fixture, '2026-05');

    expect(data.investmentHoldings).toHaveLength(1);
    expect(data.investmentHoldings[0]).toMatchObject({
      id: 'holding-valid',
      accountName: 'Broker',
      value: 200,
      transactions: [{ id: 'investment-tx-valid' }],
    });
  });
});
