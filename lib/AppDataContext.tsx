'use client';
import { createContext, useContext } from 'react';
import { Account, Category, InvestmentHolding, OverallBudget, RecurringTransaction, Settlement, Transaction } from '@/lib/data';

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  allTransactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  investmentHoldings: InvestmentHolding[];
  settlements: Settlement[];
  overallBudget: number | null;
  overallBudgetRecord: OverallBudget | null;
  yearMonth: string;
  syncError: string | null;
  userEmail: string | null;
}

const AppDataContext = createContext<AppData>({
  accounts: [],
  categories: [],
  transactions: [],
  allTransactions: [],
  recurringTransactions: [],
  investmentHoldings: [],
  settlements: [],
  overallBudget: null,
  overallBudgetRecord: null,
  yearMonth: '',
  syncError: null,
  userEmail: null,
});

export function AppDataProvider({ data, children }: { data: AppData; children: React.ReactNode }) {
  return <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  return useContext(AppDataContext);
}
