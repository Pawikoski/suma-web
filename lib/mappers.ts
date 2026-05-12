import { SyncServerChanges } from './api-types';
import { Account, Category, OverallBudget, Transaction } from './data';

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
  allTransactions: Transaction[];
  overallBudget: number | null;
  overallBudgetRecord: OverallBudget | null;
  yearMonth: string;
}

export function mapSyncData(data: SyncServerChanges, yearMonth: string): MappedData {
  const accounts: Account[] = data.accounts
    .filter(a => !a.deleted_at && a.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(a => ({
      id: a.id,
      name: a.name,
      rawType: a.type,
      type: TYPE_LABELS[a.type] ?? a.type,
      balance: parseFloat(a.balance),
      currency: a.currency,
      color: a.icon_color || '#6366f1',
      color2: lighter(a.icon_color || '#6366f1'),
      icon: a.icon_name || '💳',
      category: a.category,
      sortOrder: a.sort_order,
      includeInNetWorth: a.include_in_net_worth,
      notes: a.notes,
      updatedAt: a.updated_at,
      deletedAt: a.deleted_at,
      version: a.version,
    }));

  const accountById = new Map(data.accounts.map(a => [a.id, a]));
  const mappedAccountById = new Map(accounts.map(a => [a.id, a]));

  const categoryById = new Map(
    data.categories
      .filter(c => !c.deleted_at)
      .map(c => [c.id, c])
  );

  const budgetByCategory = new Map(
    data.category_budgets
      .filter(b => !b.deleted_at && b.type === 'EXPENSE_BUDGET' && b.category_id)
      .map(b => [b.category_id!, b])
  );

  const txById = new Map(data.transactions.map(t => [t.id, t]));
  const splitsForMonth = data.transaction_splits.filter(s => {
    if (s.deleted_at) return false;
    const tx = s.transaction_id ? txById.get(s.transaction_id) : null;
    return tx && tx.date_time.startsWith(yearMonth) && !tx.deleted_at;
  });

  const spentByCategory = new Map<string, number>();
  const countByCategory = new Map<string, Set<string>>();

  for (const split of splitsForMonth) {
    const tx = split.transaction_id ? txById.get(split.transaction_id) : null;
    if (!tx || tx.type !== 'EXPENSE') continue;
    if (!split.category_id || !split.transaction_id) continue;
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
      types: c.types,
      icon: c.icon_name || '📦',
      bg: c.icon_bg || '#f8fafc',
      color: c.icon_color || '#64748b',
      spent: spentByCategory.get(c.id) ?? 0,
      budget: budgetByCategory.has(c.id) ? parseFloat(budgetByCategory.get(c.id)!.budget_amount) : null,
      budgetId: budgetByCategory.get(c.id)?.id ?? null,
      budgetVersion: budgetByCategory.get(c.id)?.version ?? null,
      txCount: countByCategory.get(c.id)?.size ?? 0,
      parentCategoryId: c.parent_category_id,
      isSystem: c.is_system,
      sortOrder: c.sort_order,
      updatedAt: c.updated_at,
      deletedAt: c.deleted_at,
      version: c.version,
    }));

  const splitsByTx = new Map<string, typeof data.transaction_splits>();
  for (const split of data.transaction_splits.filter(s => !s.deleted_at)) {
    if (!split.transaction_id) continue;
    const arr = splitsByTx.get(split.transaction_id) ?? [];
    arr.push(split);
    splitsByTx.set(split.transaction_id, arr);
  }

  const allTransactions: Transaction[] = data.transactions
    .filter(t => !t.deleted_at)
    .sort((a, b) => b.date_time.localeCompare(a.date_time))
    .map(t => {
      const splits = splitsByTx.get(t.id) ?? [];
      const firstSplit = splits[0];
      const cat = firstSplit?.category_id ? categoryById.get(firstSplit.category_id) : null;
      const account = accountById.get(t.from_account_id);
      const mappedAccount = mappedAccountById.get(t.from_account_id);
      const toAccount = t.to_account_id ? accountById.get(t.to_account_id) : null;
      const amount = parseFloat(t.total_amount);

      return {
        id: t.id,
        date: t.date_time.slice(0, 10),
        dateTime: t.date_time,
        cat: cat?.name ?? (t.type === 'TRANSFER' ? 'Transfer' : 'Inne'),
        catIcon: cat?.icon_name ?? (t.type === 'TRANSFER' ? '↔️' : '📦'),
        catBg: cat?.icon_bg ?? '#f8fafc',
        catColor: cat?.icon_color ?? '#64748b',
        categoryId: cat?.id ?? null,
        desc: t.notes ?? '',
        acc: account?.name ?? '',
        accountId: t.from_account_id,
        toAccountId: t.to_account_id,
        toAccountName: toAccount?.name ?? null,
        currency: t.account_currency || mappedAccount?.currency || 'PLN',
        amount: t.type === 'EXPENSE' ? -amount : amount,
        rawAmount: amount,
        type: t.type === 'EXPENSE' ? 'expense' : t.type === 'INCOME' ? 'income' : 'transfer',
        loc: t.location_name ?? undefined,
        countInSummary: t.count_in_summary,
        splitIds: splits.map(s => s.id),
        updatedAt: t.updated_at,
        deletedAt: t.deleted_at,
        version: t.version,
      } satisfies Transaction;
    });
  const transactions = allTransactions.filter(t => t.date.startsWith(yearMonth));

  const activeOverallBudgets = data.overall_budgets.filter(b => !b.deleted_at);
  const activeOverallBudget = activeOverallBudgets[0] ?? null;
  const overallBudgetRecord = activeOverallBudget
    ? {
        id: activeOverallBudget.id,
        amount: parseFloat(activeOverallBudget.budget_amount),
        updatedAt: activeOverallBudget.updated_at,
        deletedAt: activeOverallBudget.deleted_at,
        version: activeOverallBudget.version,
      }
    : null;
  const overallBudget = overallBudgetRecord?.amount ?? null;

  return { accounts, categories, transactions, allTransactions, overallBudget, overallBudgetRecord, yearMonth };
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
