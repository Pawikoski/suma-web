import { SyncServerChanges } from './api-types';
import { Account, AccountBudget, AccountInterest, Category, InvestmentHolding, OverallBudget, RecurringTransaction, Settlement, Transaction } from './data';

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
  recurringTransactions: RecurringTransaction[];
  investmentHoldings: InvestmentHolding[];
  accountInterest: AccountInterest[];
  accountBudgets: AccountBudget[];
  settlements: Settlement[];
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
      liabilityKind: a.liability_kind,
      creditLimit: a.credit_limit === null ? null : parseFloat(a.credit_limit),
      statementDay: a.statement_day,
      paymentDueDay: a.payment_due_day,
      liabilityPrincipal: a.liability_principal === null ? null : parseFloat(a.liability_principal),
      liabilityMonthlyPayment: a.liability_monthly_payment === null ? null : parseFloat(a.liability_monthly_payment),
      paymentAccountId: a.payment_account_id,
      creditCardLast4: a.credit_card_last4,
      creditCardTheme: a.credit_card_theme,
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

  const photosByTx = new Map<string, Transaction['photos']>();
  for (const photo of (data.transaction_photos ?? []).filter(photo => !photo.deleted_at)) {
    if (!photo.transaction_id) continue;
    const arr = photosByTx.get(photo.transaction_id) ?? [];
    arr.push({
      id: photo.id,
      mimeType: photo.mime_type,
      contentHash: photo.content_hash,
      imageBase64: photo.image_base64,
    });
    photosByTx.set(photo.transaction_id, arr);
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
        isFromNotificationParser: t.is_from_notification_parser,
        reviewStatus: t.review_status,
        parserNotificationKey: t.parser_notification_key,
        splitIds: splits.map(s => s.id),
        splits: splits.map(s => ({
          id: s.id,
          categoryId: s.category_id,
          amount: parseFloat(s.amount),
        })),
        photos: photosByTx.get(t.id) ?? [],
        updatedAt: t.updated_at,
        deletedAt: t.deleted_at,
        version: t.version,
      } satisfies Transaction;
    });
  const transactions = allTransactions.filter(t => t.date.startsWith(yearMonth));

  const recurringTransactions: RecurringTransaction[] = (data.recurring_transactions ?? [])
    .filter(r => !r.deleted_at)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map(r => {
      const fromAccount = r.from_account_id ? accountById.get(r.from_account_id) : null;
      const toAccount = r.to_account_id ? accountById.get(r.to_account_id) : null;
      return {
        id: r.id,
        type: r.type === 'EXPENSE' ? 'expense' : r.type === 'INCOME' ? 'income' : 'transfer',
        rawType: r.type,
        amount: r.total_amount === null ? null : parseFloat(r.total_amount),
        currency: r.account_currency || fromAccount?.currency || 'PLN',
        fromAccountId: r.from_account_id,
        fromAccountName: fromAccount?.name ?? null,
        toAccountId: r.to_account_id,
        toAccountName: toAccount?.name ?? null,
        notes: r.notes ?? '',
        locationName: r.location_name,
        frequency: r.frequency,
        intervalValue: r.interval_value,
        startDate: r.start_date.slice(0, 10),
        endDate: r.end_date ? r.end_date.slice(0, 10) : null,
        lastGeneratedDate: r.last_generated_date ? r.last_generated_date.slice(0, 10) : null,
        skippedOccurrenceDates: r.skipped_occurrence_dates.map(date => date.slice(0, 10)),
        categorySplits: r.category_splits.map(split => ({
          categoryId: split.category_id,
          amount: parseFloat(split.amount),
        })),
        recurringCategory: r.recurring_category,
        recurringCategoryLabel: r.recurring_category_label?.trim() || null,
        isActive: r.is_active,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        version: r.version,
      } satisfies RecurringTransaction;
    });

  const investmentTransactionsByHoldingId = new Map<string, InvestmentHolding['transactions']>();
  for (const tx of (data.investment_transactions ?? []).filter(tx => !tx.deleted_at)) {
    if (!tx.holding_id) continue;
    const mapped = {
      id: tx.id,
      holdingId: tx.holding_id,
      type: tx.type,
      quantity: tx.quantity,
      unitPrice: parseFloat(tx.unit_price),
      currency: tx.currency,
      date: tx.date.slice(0, 10),
      notes: tx.notes,
      updatedAt: tx.updated_at,
      deletedAt: tx.deleted_at,
      version: tx.version,
    };
    const entries = investmentTransactionsByHoldingId.get(tx.holding_id) ?? [];
    entries.push(mapped);
    investmentTransactionsByHoldingId.set(tx.holding_id, entries);
  }

  const investmentHoldings: InvestmentHolding[] = (data.investment_holdings ?? [])
    .filter(holding => {
      if (holding.deleted_at || !holding.account_id) return false;
      const account = mappedAccountById.get(holding.account_id);
      return Boolean(account && account.rawType === 'INVESTMENT' && account.category !== 'LIABILITY');
    })
    .map(holding => {
      const account = holding.account_id ? mappedAccountById.get(holding.account_id) : null;
      const unitPrice = parseFloat(holding.unit_price);
      const transactions = investmentTransactionsByHoldingId.get(holding.id) ?? [];
      return {
        id: holding.id,
        accountId: holding.account_id,
        accountName: account?.name ?? null,
        symbol: holding.symbol,
        name: holding.name,
        investmentType: holding.investment_type,
        quantity: holding.quantity,
        unitPrice,
        value: holding.quantity * unitPrice,
        currency: holding.currency,
        purchaseCurrency: holding.purchase_currency,
        notes: holding.notes,
        transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
        updatedAt: holding.updated_at,
        deletedAt: holding.deleted_at,
        version: holding.version,
      } satisfies InvestmentHolding;
    })
    .sort((a, b) => (a.accountName ?? '').localeCompare(b.accountName ?? '') || a.symbol.localeCompare(b.symbol));

  const accountInterest: AccountInterest[] = (data.account_interest ?? [])
    .filter(interest => !interest.deleted_at && interest.is_active)
    .map(interest => {
      const account = interest.account_id ? mappedAccountById.get(interest.account_id) : null;
      const targetAccount = interest.target_account_id ? mappedAccountById.get(interest.target_account_id) : null;
      const baseAmount = interest.base_amount === null ? null : parseFloat(interest.base_amount);
      return {
        id: interest.id,
        accountId: interest.account_id,
        accountName: account?.name ?? null,
        annualRatePercent: interest.annual_rate_percent,
        baseAmount,
        effectiveBaseAmount: baseAmount ?? account?.balance ?? 0,
        startDate: interest.start_date.slice(0, 10),
        endDate: interest.end_date.slice(0, 10),
        taxRatePercent: interest.tax_rate_percent,
        afterMaturityAction: interest.after_maturity_action,
        targetAccountId: interest.target_account_id,
        targetAccountName: targetAccount?.name ?? null,
        isActive: interest.is_active,
        interestCategoryId: interest.interest_category_id,
        monthlyPayment: interest.monthly_payment === null ? null : parseFloat(interest.monthly_payment),
        originalLoanAmount: interest.original_loan_amount === null ? null : parseFloat(interest.original_loan_amount),
        updatedAt: interest.updated_at,
        deletedAt: interest.deleted_at,
        version: interest.version,
      } satisfies AccountInterest;
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const accountBudgetOverrideByAccountId = new Map(
    (data.account_budget_overrides ?? [])
      .filter(override => !override.deleted_at && override.account_id && override.year_month === yearMonth)
      .map(override => [override.account_id!, override])
  );
  const accountBudgets: AccountBudget[] = (data.account_budgets ?? [])
    .filter(budget => !budget.deleted_at)
    .map(budget => {
      const account = budget.account_id ? mappedAccountById.get(budget.account_id) : null;
      const override = budget.account_id ? accountBudgetOverrideByAccountId.get(budget.account_id) : null;
      return {
        id: budget.id,
        accountId: budget.account_id,
        accountName: account?.name ?? null,
        amount: parseFloat(override?.budget_amount ?? budget.budget_amount),
        baseAmount: parseFloat(budget.budget_amount),
        overrideId: override?.id ?? null,
        yearMonth,
        updatedAt: override?.updated_at ?? budget.updated_at,
        deletedAt: override?.deleted_at ?? budget.deleted_at,
        version: override?.version ?? budget.version,
      } satisfies AccountBudget;
    })
    .sort((a, b) => (a.accountName ?? '').localeCompare(b.accountName ?? ''));

  const paymentAccountById = new Map(accounts.map(account => [account.id, account]));
  const paymentsBySettlementId = new Map<string, Settlement['payments']>();
  for (const payment of (data.settlement_payments ?? []).filter(payment => !payment.deleted_at)) {
    if (!payment.settlement_id) continue;
    const account = payment.account_id ? paymentAccountById.get(payment.account_id) : null;
    const mapped = {
      id: payment.id,
      settlementId: payment.settlement_id,
      accountId: payment.account_id,
      accountName: account?.name ?? null,
      transactionId: payment.transaction_id,
      amount: parseFloat(payment.amount),
      paidAt: payment.paid_at,
      note: payment.note,
      updatedAt: payment.updated_at,
      deletedAt: payment.deleted_at,
      version: payment.version,
    };
    const entries = paymentsBySettlementId.get(payment.settlement_id) ?? [];
    entries.push(mapped);
    paymentsBySettlementId.set(payment.settlement_id, entries);
  }

  const today = new Date().toISOString().slice(0, 10);
  const settlements: Settlement[] = (data.settlements ?? [])
    .filter(settlement => !settlement.deleted_at)
    .map(settlement => {
      const payments = paymentsBySettlementId.get(settlement.id) ?? [];
      const account = settlement.account_id ? paymentAccountById.get(settlement.account_id) : null;
      const repaidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const totalAmount = parseFloat(settlement.total_amount);
      const remainingAmount = Math.max(totalAmount - repaidAmount, 0);
      const dueDate = settlement.due_date ? settlement.due_date.slice(0, 10) : null;
      return {
        id: settlement.id,
        direction: settlement.direction,
        accountId: settlement.account_id,
        accountName: account?.name ?? null,
        transactionId: settlement.transaction_id,
        counterpartyName: settlement.counterparty_name,
        counterpartyEmail: settlement.counterparty_email,
        totalAmount,
        repaidAmount,
        remainingAmount,
        currency: settlement.currency,
        note: settlement.note,
        dueDate,
        reminderDaysBefore: settlement.reminder_days_before,
        status: settlement.status,
        isOverdue: settlement.status === 'ACTIVE' && remainingAmount > 0 && dueDate !== null && dueDate < today,
        payments: payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
        updatedAt: settlement.updated_at,
        deletedAt: settlement.deleted_at,
        version: settlement.version,
      } satisfies Settlement;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
      return (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
    });

  const activeOverallBudgets = data.overall_budgets.filter(b => !b.deleted_at);
  const activeOverallBudget = activeOverallBudgets[0] ?? null;
  const activeOverallOverride = (data.overall_budget_overrides ?? []).find(override => !override.deleted_at && override.year_month === yearMonth) ?? null;
  const overallBudgetRecord = activeOverallOverride
    ? {
        id: activeOverallOverride.id,
        amount: parseFloat(activeOverallOverride.budget_amount),
        updatedAt: activeOverallOverride.updated_at,
        deletedAt: activeOverallOverride.deleted_at,
        version: activeOverallOverride.version,
      }
    : activeOverallBudget
    ? {
        id: activeOverallBudget.id,
        amount: parseFloat(activeOverallBudget.budget_amount),
        updatedAt: activeOverallBudget.updated_at,
        deletedAt: activeOverallBudget.deleted_at,
        version: activeOverallBudget.version,
      }
    : null;
  const overallBudget = overallBudgetRecord?.amount ?? null;

  return { accounts, categories, transactions, allTransactions, recurringTransactions, investmentHoldings, accountInterest, accountBudgets, settlements, overallBudget, overallBudgetRecord, yearMonth };
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
