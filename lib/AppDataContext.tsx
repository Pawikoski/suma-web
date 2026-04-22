'use client';
import { createContext, useContext } from 'react';
import { Account, Category, Transaction } from '@/lib/data';

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  overallBudget: number | null;
}

const AppDataContext = createContext<AppData>({
  accounts: [],
  categories: [],
  transactions: [],
  overallBudget: null,
});

export function AppDataProvider({ data, children }: { data: AppData; children: React.ReactNode }) {
  return <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  return useContext(AppDataContext);
}
