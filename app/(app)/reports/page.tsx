import { Suspense } from 'react';
import ReportsScreen from '@/components/screens/ReportsScreen';

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
