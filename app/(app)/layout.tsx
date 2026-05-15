import { fetchSync } from '@/lib/api';
import { mapSyncData, currentYearMonth } from '@/lib/mappers';
import { AppDataProvider } from '@/lib/AppDataContext';
import AppShell from '@/components/AppShell';
import { getSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const syncResult = await fetchSync()
    .then(syncData => ({ syncData, syncError: null as string | null }))
    .catch((error: unknown) => ({
      syncData: null,
      syncError: error instanceof Error ? error.message : 'Nie udało się pobrać danych.',
    }));

  const data = syncResult.syncData
    ? mapSyncData(syncResult.syncData.server_changes, currentYearMonth())
    : {
        accounts: [],
        categories: [],
        transactions: [],
        allTransactions: [],
        recurringTransactions: [],
        investmentHoldings: [],
        settlements: [],
        overallBudget: null,
        overallBudgetRecord: null,
        yearMonth: currentYearMonth(),
      };

  return (
    <AppDataProvider data={{ ...data, syncError: syncResult.syncError, userEmail: session?.email ?? null }}>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
