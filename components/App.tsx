'use client';
import { useEffect, useState } from 'react';
import { T } from '@/lib/tokens';
import { Account, Category, Transaction } from '@/lib/data';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import HomeScreen from '@/components/screens/HomeScreen';
import TransactionsScreen from '@/components/screens/TransactionsScreen';
import CategoriesScreen from '@/components/screens/CategoriesScreen';
import AccountsScreen from '@/components/screens/AccountsScreen';
import BudgetScreen from '@/components/screens/BudgetScreen';
import AddTransactionModal from '@/components/modals/AddTransactionModal';

export type ScreenId = 'home' | 'transactions' | 'categories' | 'accounts' | 'budget';

const SCREEN_TITLES: Record<ScreenId, string> = {
  home: 'Home', transactions: 'Transakcje', categories: 'Kategorie', accounts: 'Konta', budget: 'Budżet',
};

interface AppProps {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  overallBudget: number | null;
}

const SCREEN_IDS: ScreenId[] = ['home', 'transactions', 'categories', 'accounts', 'budget'];

export default function App({ accounts, categories, transactions, overallBudget }: AppProps) {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && SCREEN_IDS.includes(tab as ScreenId)) setScreen(tab as ScreenId);
  }, []);

  const handleSelectTx = (tx: Transaction) => {
    setSelectedTx(tx);
    if (screen !== 'transactions') handleNav('transactions');
  };

  const handleNav = (id: ScreenId) => {
    setScreen(id);
    setSelectedTx(null);
    window.history.replaceState({}, '', `?tab=${id}`);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar active={screen} onNav={handleNav} onAdd={() => setShowAdd(true)} />

      <div style={{ flex: 1, marginLeft: T.sidebarW, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar title={SCREEN_TITLES[screen]} />
        <div style={{ flex: 1, overflowY: screen === 'transactions' ? 'hidden' : 'auto', background: T.bg }}>
          {screen === 'home' && (
            <HomeScreen
              accounts={accounts}
              categories={categories}
              transactions={transactions}
              overallBudget={overallBudget}
              onNav={handleNav}
              onSelectTx={handleSelectTx}
            />
          )}
          {screen === 'transactions' && (
            <TransactionsScreen
              transactions={transactions}
              selectedTx={selectedTx}
              onSelectTx={setSelectedTx}
            />
          )}
          {screen === 'categories' && (
            <CategoriesScreen categories={categories} />
          )}
          {screen === 'accounts' && (
            <AccountsScreen
              accounts={accounts}
              transactions={transactions}
              onSelectTx={handleSelectTx}
            />
          )}
          {screen === 'budget' && (
            <BudgetScreen
              categories={categories}
              overallBudget={overallBudget}
            />
          )}
        </div>
      </div>

      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          accounts={accounts}
          categories={categories}
        />
      )}
    </div>
  );
}
