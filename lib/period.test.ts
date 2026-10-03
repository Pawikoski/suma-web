import { describe, expect, it } from 'vitest';
import { categoriesForMonth, filterTransactionsByMonth } from './period';
import { Category, Transaction } from './data';

const category: Category = {
  id: 'cat-food',
  name: 'Food',
  types: ['EXPENSE'],
  icon: 'shopping_cart',
  bg: '#fff',
  color: '#111',
  spent: 0,
  budget: null,
  budgetId: null,
  budgetVersion: null,
  txCount: 0,
  parentCategoryId: null,
  isSystem: false,
  sortOrder: 1,
  updatedAt: '2026-05-01T00:00:00Z',
  deletedAt: null,
  version: 1,
};

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx',
  date: '2026-05-10',
  dateTime: '2026-05-10T12:00:00Z',
  cat: 'Food',
  catIcon: 'shopping_cart',
  catBg: '#fff',
  catColor: '#111',
  categoryId: 'cat-food',
  desc: '',
  acc: 'Cash',
  accountId: 'acc',
  toAccountId: null,
  toAccountName: null,
  currency: 'PLN',
  amount: -10,
  rawAmount: 10,
  type: 'expense',
  countInSummary: true,
  isFromNotificationParser: false,
  reviewStatus: null,
  parserNotificationKey: null,
  splitIds: ['split'],
  splits: [{ id: 'split', categoryId: 'cat-food', amount: 10 }],
  photos: [],
  updatedAt: '2026-05-10T12:00:00Z',
  deletedAt: null,
  version: 1,
  ...overrides,
});

describe('period helpers', () => {
  it('filters transactions by selected month', () => {
    const txs = [
      transaction({ id: 'may', date: '2026-05-10' }),
      transaction({ id: 'april', date: '2026-04-10' }),
    ];

    expect(filterTransactionsByMonth(txs, '2026-05').map(tx => tx.id)).toEqual(['may']);
  });

  it('derives category spending from split categories in the selected month', () => {
    const categories = categoriesForMonth(
      [category],
      [
        transaction({ id: 'may', date: '2026-05-10', splits: [{ id: 'split-1', categoryId: 'cat-food', amount: 12 }] }),
        transaction({ id: 'old', date: '2026-04-10', splits: [{ id: 'split-2', categoryId: 'cat-food', amount: 99 }] }),
      ],
      '2026-05'
    );

    expect(categories[0]).toMatchObject({ spent: 12, txCount: 1 });
  });

  it('converts split amounts to the main currency and leaves out those without a rate', () => {
    const toBase = (amount: number, currency: string) => (currency === 'USD' ? amount * 3.65 : currency === 'PLN' ? amount : null);
    const categories = categoriesForMonth(
      [category],
      [
        transaction({ id: 'usd', date: '2026-05-10', currency: 'USD', splits: [{ id: 'a', categoryId: 'cat-food', amount: 400 }] }),
        transaction({ id: 'pln', date: '2026-05-11', currency: 'PLN', splits: [{ id: 'b', categoryId: 'cat-food', amount: 10 }] }),
        transaction({ id: 'gbp', date: '2026-05-12', currency: 'GBP', splits: [{ id: 'c', categoryId: 'cat-food', amount: 50 }] }),
      ],
      '2026-05',
      toBase,
    );

    expect(categories[0].spent).toBeCloseTo(1470);
  });
});
