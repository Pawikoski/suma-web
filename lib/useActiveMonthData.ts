'use client';

import { useEffect, useMemo } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { useAppData } from './AppDataContext';
import { convertToBase, sumInBase } from './fx';
import { availableMonths, categoriesForMonth, filterTransactionsByMonth } from './period';
import { useSumaUiStore } from './stores/ui-store';

export function useActiveMonthData() {
  const data = useAppData();
  const [activeMonth, setActiveMonthParam] = useQueryState('month', parseAsString.withDefault(data.yearMonth));
  const setActiveMonth = useSumaUiStore(state => state.setActiveMonth);

  useEffect(() => {
    setActiveMonth(activeMonth);
  }, [activeMonth, setActiveMonth]);

  const months = useMemo(
    () => availableMonths(data.allTransactions, data.yearMonth),
    [data.allTransactions, data.yearMonth]
  );
  const transactions = useMemo(
    () => filterTransactionsByMonth(data.allTransactions, activeMonth),
    [activeMonth, data.allTransactions]
  );
  const { baseCurrency, fxRates } = data;
  const categories = useMemo(
    () => categoriesForMonth(
      data.categories,
      data.allTransactions,
      activeMonth,
      (amount, currency) => convertToBase(amount, currency, baseCurrency, fxRates),
    ),
    [activeMonth, data.allTransactions, data.categories, baseCurrency, fxRates]
  );
  // Totals are in the main currency: amounts in other currencies are converted, not added as they are.
  const totals = useMemo(() => {
    const netWorth = sumInBase(
      data.accounts.filter(account => account.includeInNetWorth), account => account.balance, account => account.currency, baseCurrency, fxRates,
    );
    const income = sumInBase(
      transactions.filter(tx => tx.type === 'income'), tx => tx.amount, tx => tx.currency, baseCurrency, fxRates,
    );
    const expense = sumInBase(
      transactions.filter(tx => tx.type === 'expense'), tx => tx.amount, tx => tx.currency, baseCurrency, fxRates,
    );
    return {
      netWorth: netWorth.total,
      income: income.total,
      expense: Math.abs(expense.total),
      skippedCurrencies: [...new Set([...netWorth.skipped, ...income.skipped, ...expense.skipped])].sort(),
    };
  }, [data.accounts, transactions, baseCurrency, fxRates]);

  return {
    ...data,
    activeMonth,
    setActiveMonthParam,
    availableMonths: months,
    transactions,
    categories,
    totals,
  };
}
