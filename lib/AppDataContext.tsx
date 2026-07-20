'use client';
import { createContext, useContext } from 'react';
import { Account, AccountBudget, AccountInterest, Category, InvestmentHolding, OverallBudget, RecurringTransaction, Settlement, Transaction } from '@/lib/data';
import { fallbackCurrency } from '@/lib/utils';

export interface AppData {
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
  baseCurrency: string;
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
  accountInterest: [],
  accountBudgets: [],
  settlements: [],
  overallBudget: null,
  overallBudgetRecord: null,
  baseCurrency: fallbackCurrency(),
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
