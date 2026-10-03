import { Category, Transaction } from './data';

export function availableMonths(transactions: Transaction[], fallbackMonth: string): string[] {
  return Array.from(new Set([fallbackMonth, ...transactions.map(tx => tx.date.slice(0, 7))]))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
}

export function filterTransactionsByMonth(transactions: Transaction[], month: string): Transaction[] {
  if (month === 'all') return transactions;
  return transactions.filter(tx => tx.date.startsWith(month));
}

/** `toBase` converts a split into the main currency (null = no rate, the split is left out); by default amounts are used as they are. */
export function categoriesForMonth(
  categories: Category[],
  transactions: Transaction[],
  month: string,
  toBase: (amount: number, currency: string) => number | null = amount => amount,
): Category[] {
  const periodTransactions = filterTransactionsByMonth(transactions, month);
  const spentByCategory = new Map<string, number>();
  const countByCategory = new Map<string, Set<string>>();

  for (const tx of periodTransactions) {
    if (tx.type !== 'expense') continue;

    for (const split of tx.splits) {
      if (!split.categoryId) continue;
      const amount = toBase(split.amount, tx.currency);
      if (amount === null) continue;
      spentByCategory.set(split.categoryId, (spentByCategory.get(split.categoryId) ?? 0) + amount);
      const ids = countByCategory.get(split.categoryId) ?? new Set<string>();
      ids.add(tx.id);
      countByCategory.set(split.categoryId, ids);
    }
  }

  return categories.map(category => ({
    ...category,
    spent: spentByCategory.get(category.id) ?? 0,
    txCount: countByCategory.get(category.id)?.size ?? 0,
  }));
}
