export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  color2: string;
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  bg: string;
  color: string;
  spent: number;
  budget: number | null;
  txCount: number;
}

export interface Transaction {
  id: string;
  date: string;
  cat: string;
  catIcon: string;
  catBg: string;
  catColor: string;
  desc: string;
  acc: string;
  amount: number;
  type: TransactionType;
  loc?: string;
}
