'use client';

import { create } from 'zustand';

interface SumaUiState {
  activeMonth: string;
  isAddTransactionOpen: boolean;
  selectedTransactionId: string | null;
  setActiveMonth: (activeMonth: string) => void;
  openAddTransaction: () => void;
  closeAddTransaction: () => void;
  selectTransaction: (transactionId: string) => void;
  clearSelectedTransaction: () => void;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const useSumaUiStore = create<SumaUiState>((set) => ({
  activeMonth: currentYearMonth(),
  isAddTransactionOpen: false,
  selectedTransactionId: null,
  setActiveMonth: (activeMonth) => set({ activeMonth }),
  openAddTransaction: () => set({ isAddTransactionOpen: true }),
  closeAddTransaction: () => set({ isAddTransactionOpen: false }),
  selectTransaction: (selectedTransactionId) => set({ selectedTransactionId }),
  clearSelectedTransaction: () => set({ selectedTransactionId: null }),
}));
