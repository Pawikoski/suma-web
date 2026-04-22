import { SyncServerChanges } from './api-types';
import { Account, Category, Transaction } from './data';

const TYPE_LABELS: Record<string, string> = {
  CASH: 'Gotówka',
  BANK: 'Konto bankowe',
  PROPERTY: 'Nieruchomość',
  INVESTMENT: 'Inwestycje',
};

function lighter(hex: string): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 60);
    const g = Math.min(255, ((n >> 8) & 0xff) + 60);
    const b = Math.min(255, (n & 0xff) + 60);
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return hex;
  }
}

export interface MappedData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  overallBudget: number | null;
}

export function mapSyncData(data: SyncServerChanges, yearMonth: string): MappedData {
  const accounts: Account[] = data.accounts
    .filter(a => !a.deleted_at && a.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(a => ({
      id: a.id,
      name: a.name,
      type: TYPE_LABELS[a.type] ?? a.type,
      balance: parseFloat(a.balance),
      color: a.icon_color || '#6366f1',
      color2: lighter(a.icon_color || '#6366f1'),
      icon: a.icon_name || '💳',
    }));

  const accountById = new Map(data.accounts.map(a => [a.id, a]));

  const categoryById = new Map(
    data.categories
      .filter(c => !c.deleted_at)
      .map(c => [c.id, c])
  );

  const budgetByCategory = new Map(
    data.category_budgets
      .filter(b => !b.deleted_at && b.type === 'EXPENSE_BUDGET')
      .map(b => [b.category_id, parseFloat(b.budget_amount)])
  );

  const splitsForMonth = data.transaction_splits.filter(s => {
    if (s.deleted_at) return false;
    const tx = data.transactions.find(t => t.id === s.transaction_id);
    return tx && tx.date_time.startsWith(yearMonth) && !tx.deleted_at;
  });

  const spentByCategory = new Map<string, number>();
  const countByCategory = new Map<string, Set<string>>();

  for (const split of splitsForMonth) {
    const tx = data.transactions.find(t => t.id === split.transaction_id);
    if (!tx || tx.type !== 'EXPENSE') continue;
    const prev = spentByCategory.get(split.category_id) ?? 0;
    spentByCategory.set(split.category_id, prev + parseFloat(split.amount));
    const set = countByCategory.get(split.category_id) ?? new Set();
    set.add(split.transaction_id);
    countByCategory.set(split.category_id, set);
  }

  const categories: Category[] = data.categories
    .filter(c => !c.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon_name || '📦',
      bg: c.icon_bg || '#f8fafc',
      color: c.icon_color || '#64748b',
      spent: spentByCategory.get(c.id) ?? 0,
      budget: budgetByCategory.get(c.id) ?? null,
      txCount: countByCategory.get(c.id)?.size ?? 0,
    }));

  const splitsByTx = new Map<string, typeof data.transaction_splits>();
  for (const split of data.transaction_splits.filter(s => !s.deleted_at)) {
    const arr = splitsByTx.get(split.transaction_id) ?? [];
    arr.push(split);
    splitsByTx.set(split.transaction_id, arr);
  }

  const transactions: Transaction[] = data.transactions
    .filter(t => !t.deleted_at && t.date_time.startsWith(yearMonth))
    .sort((a, b) => b.date_time.localeCompare(a.date_time))
    .map(t => {
      const splits = splitsByTx.get(t.id) ?? [];
      const firstSplit = splits[0];
      const cat = firstSplit ? categoryById.get(firstSplit.category_id) : null;
      const account = accountById.get(t.from_account_id);
      const amount = parseFloat(t.total_amount);

      return {
        id: t.id,
        date: t.date_time.slice(0, 10),
        cat: cat?.name ?? (t.type === 'TRANSFER' ? 'Transfer' : 'Inne'),
        catIcon: cat?.icon_name ?? (t.type === 'TRANSFER' ? '↔️' : '📦'),
        catBg: cat?.icon_bg ?? '#f8fafc',
        catColor: cat?.icon_color ?? '#64748b',
        desc: t.notes ?? '',
        acc: account?.name ?? '',
        amount: t.type === 'EXPENSE' ? -amount : amount,
        type: t.type === 'EXPENSE' ? 'expense' : t.type === 'INCOME' ? 'income' : 'transfer',
        loc: t.location_name ?? undefined,
      } satisfies Transaction;
    });

  const activeOverallBudgets = data.overall_budgets.filter(b => !b.deleted_at);
  const overallBudget = activeOverallBudgets.length > 0
    ? parseFloat(activeOverallBudgets[0].budget_amount)
    : null;

  return { accounts, categories, transactions, overallBudget };
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
