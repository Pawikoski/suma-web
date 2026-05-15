import { Suspense } from 'react';
import ImportExportScreen from '@/components/screens/ImportExportScreen';

export default function ImportExportPage() {
  return (
    <Suspense>
      <ImportExportScreen />
    </Suspense>
  );
}
