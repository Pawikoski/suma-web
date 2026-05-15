import { Suspense } from 'react';
import RecurringScreen from '@/components/screens/RecurringScreen';

export default function RecurringPage() {
  return (
    <Suspense>
      <RecurringScreen />
    </Suspense>
  );
}
