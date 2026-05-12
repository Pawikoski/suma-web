'use client';
import { usePathname } from 'next/navigation';
import { T } from '@/lib/tokens';
import { useAppData } from '@/lib/AppDataContext';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import AddTransactionModal from '@/components/modals/AddTransactionModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { accounts, categories, syncError } = useAppData();
  const pathname = usePathname();
  const isAddTransactionOpen = useSumaUiStore(state => state.isAddTransactionOpen);
  const openAddTransaction = useSumaUiStore(state => state.openAddTransaction);
  const closeAddTransaction = useSumaUiStore(state => state.closeAddTransaction);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar onAdd={openAddTransaction} />

      <div style={{ flex: 1, marginLeft: T.sidebarW, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        {syncError && (
          <div style={{ padding: '10px 20px', background: T.warnSoft, color: '#92400e', borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}>
            Nie udało się pobrać danych z API. Widok może być nieaktualny: {syncError}
          </div>
        )}
        <div style={{ flex: 1, overflowY: pathname === '/transactions' ? 'hidden' : 'auto', background: T.bg }}>
          {children}
        </div>
      </div>

      {isAddTransactionOpen && (
        <AddTransactionModal
          onClose={closeAddTransaction}
          accounts={accounts}
          categories={categories}
        />
      )}
    </div>
  );
}
