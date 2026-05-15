import { Suspense } from 'react';
import SettlementsScreen from '@/components/screens/SettlementsScreen';

export default function SettlementsPage() {
  return (
    <Suspense>
      <SettlementsScreen />
    </Suspense>
  );
}
