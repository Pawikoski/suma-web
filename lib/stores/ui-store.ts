'use client';

import { create } from 'zustand';

interface SumaUiState {
  activeMonth: string;
  isAddTransactionOpen: boolean;
  isCommandOpen: boolean;
  privacyMode: boolean;
  selectedTransactionId: string | null;
  setActiveMonth: (activeMonth: string) => void;
  openAddTransaction: () => void;
  closeAddTransaction: () => void;
  openCommand: () => void;
  closeCommand: () => void;
  togglePrivacyMode: () => void;
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
  isCommandOpen: false,
  privacyMode: false,
  selectedTransactionId: null,
  setActiveMonth: (activeMonth) => set({ activeMonth }),
  openAddTransaction: () => set({ isAddTransactionOpen: true }),
  closeAddTransaction: () => set({ isAddTransactionOpen: false }),
  openCommand: () => set({ isCommandOpen: true }),
  closeCommand: () => set({ isCommandOpen: false }),
  togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
  selectTransaction: (selectedTransactionId) => set({ selectedTransactionId }),
  clearSelectedTransaction: () => set({ selectedTransactionId: null }),
}));
