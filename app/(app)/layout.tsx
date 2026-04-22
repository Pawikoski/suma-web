import { fetchSync } from '@/lib/api';
import { mapSyncData, currentYearMonth } from '@/lib/mappers';
import { AppDataProvider } from '@/lib/AppDataContext';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const syncData = await fetchSync();

  const data = syncData
    ? mapSyncData(syncData.server_changes, currentYearMonth())
    : { accounts: [], categories: [], transactions: [], overallBudget: null };

  return (
    <AppDataProvider data={data}>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
