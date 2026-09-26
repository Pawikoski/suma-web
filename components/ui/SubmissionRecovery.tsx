'use client';
import { useState, useTransition } from 'react';
import { reconcileSubmissionAction } from '@/app/actions/sync';
import { SubmissionGuard } from '@/lib/useSubmissionGuard';

export default function SubmissionRecovery({ guard, onResolved, onRetry, busy }: {
  guard: SubmissionGuard; onResolved: () => void; onRetry?: () => void; busy: boolean;
}) {
  const [message, setMessage] = useState('');
  const [checked, setChecked] = useState(false);
  const [checking, startChecking] = useTransition();
  if (!guard.blocked || busy) return null;
  const check = () => startChecking(async () => {
    if (!guard.pending) { setMessage('Nie można odczytać zapisu próby. Sprawdź historię przed odblokowaniem.'); setChecked(true); return; }
    try {
      const result = await reconcileSubmissionAction({ id: guard.pending.id, count: guard.pending.count });
      if (!result.ok) { setMessage(result.message); return; }
      if (result.found === result.total) { guard.finish(); onResolved(); return; }
      setMessage(`Na serwerze znaleziono ${result.found} z ${result.total} zapisów tej próby. Sprawdź historię przed rozpoczęciem nowej operacji.`);
      setChecked(true);
    } catch { setMessage('Nie udało się sprawdzić wyniku. Spróbuj ponownie po odzyskaniu połączenia.'); }
  });
  return <div role="alert" style={{ padding: 12, background: '#FEF3C7', color: '#78350F', fontSize: 13 }}>
    <p>Poprzedni zapis nie ma potwierdzonego wyniku. Nowa operacja jest wstrzymana, aby uniknąć duplikatów.</p>
    {message && <p>{message}</p>}
    <button onClick={check} disabled={checking} style={{ padding: 8, fontWeight: 700 }}>Sprawdź wynik na serwerze</button>
    {onRetry && <button onClick={onRetry} disabled={checking} style={{ padding: 8, fontWeight: 700 }}>Ponów tę samą próbę</button>}
    {checked && <button onClick={() => { guard.finish(); onResolved(); }} style={{ padding: 8 }}>Sprawdziłem historię — rozpocznij nową operację</button>}
  </div>;
}
