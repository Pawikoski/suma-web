'use client';

import { useEffect, useMemo } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { useAppData } from './AppDataContext';
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
  const categories = useMemo(
    () => categoriesForMonth(data.categories, data.allTransactions, activeMonth),
    [activeMonth, data.allTransactions, data.categories]
  );

  return {
    ...data,
    activeMonth,
    setActiveMonthParam,
    availableMonths: months,
    transactions,
    categories,
  };
}
