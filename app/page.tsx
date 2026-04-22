import { fetchSync } from '@/lib/api';
import { mapSyncData, currentYearMonth } from '@/lib/mappers';
import App from '@/components/App';

export default async function Page() {
  const syncData = await fetchSync();
  const yearMonth = currentYearMonth();

  if (!syncData) {
    return <App accounts={[]} categories={[]} transactions={[]} overallBudget={null} />;
  }

  const { accounts, categories, transactions, overallBudget } = mapSyncData(
    syncData.server_changes,
    yearMonth
  );

  return (
    <App
      accounts={accounts}
      categories={categories}
      transactions={transactions}
      overallBudget={overallBudget}
    />
  );
}
