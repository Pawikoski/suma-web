import { Suspense } from 'react';
import TransactionsScreen from '@/components/screens/TransactionsScreen';

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsScreen />
    </Suspense>
  );
}
