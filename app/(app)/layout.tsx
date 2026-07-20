import { fetchSync, fetchSyncPreference } from '@/lib/api';
import { mapSyncData, currentYearMonth } from '@/lib/mappers';
import { AppDataProvider } from '@/lib/AppDataContext';
import AppShell from '@/components/AppShell';
import { getSession } from '@/lib/session';
import { fallbackCurrency } from '@/lib/utils';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const [syncResult, syncPreference] = await Promise.all([
    fetchSync()
      .then(syncData => ({ syncData, syncError: null as string | null }))
      .catch((error: unknown) => ({
        syncData: null,
        syncError: error instanceof Error ? error.message : 'Nie udało się pobrać danych.',
      })),
    fetchSyncPreference().catch(() => null),
  ]);
  const preferredCurrency = syncPreference?.default_currency;

  const data = syncResult.syncData
    ? mapSyncData(syncResult.syncData.server_changes, currentYearMonth(), preferredCurrency)
    : {
        accounts: [],
        categories: [],
        transactions: [],
        allTransactions: [],
        recurringTransactions: [],
        investmentHoldings: [],
        accountInterest: [],
        accountBudgets: [],
        settlements: [],
        baseCurrency: fallbackCurrency(preferredCurrency),
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
