'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { T } from '@/lib/tokens';
import { useAppData } from '@/lib/AppDataContext';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import AddTransactionModal from '@/components/modals/AddTransactionModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [showAdd, setShowAdd] = useState(false);
  const { accounts, categories } = useAppData();
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar onAdd={() => setShowAdd(true)} />

      <div style={{ flex: 1, marginLeft: T.sidebarW, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <div style={{ flex: 1, overflowY: pathname === '/transactions' ? 'hidden' : 'auto', background: T.bg }}>
          {children}
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
