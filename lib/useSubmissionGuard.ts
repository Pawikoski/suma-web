'use client';
import { useRef, useSyncExternalStore } from 'react';

type PendingSubmission = { id: string; count: number; submittedAt: string };
const readMarker = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const eventName = 'suma-submission-change';
const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener(eventName, notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(eventName, notify); };
};

export function useSubmissionGuard(userEmail: string | null, kind: 'transaction' | 'import') {
  const key = `suma:pending:${encodeURIComponent(userEmail ?? 'unknown')}:${kind}`;
  const draft = useRef<PendingSubmission | null>(null);
  const stored = useSyncExternalStore(subscribe, () => readMarker(key), () => null);
  let pending: PendingSubmission | null = null;
  try { if (stored) { const value = JSON.parse(stored) as PendingSubmission; if (typeof value.id === 'string' && Number.isInteger(value.count) && value.count > 0 && typeof value.submittedAt === 'string') pending = value; } } catch { /* malformed local marker is cleared by explicit acknowledgement */ }
  const finish = () => {
    const expectedId = draft.current?.id ?? pending?.id;
    const current = readMarker(key);
    if (current && expectedId) {
      try { if (JSON.parse(current).id !== expectedId) return; } catch { /* explicit repair of malformed marker */ }
    }
    localStorage.removeItem(key); draft.current = null; window.dispatchEvent(new Event(eventName));
  };
  const begin = (count: number) => {
    const current = localStorage.getItem(key);
    if (current && !draft.current) throw new Error('Najpierw sprawdź wynik poprzedniej operacji.');
    if (!draft.current) draft.current = { id: crypto.randomUUID(), count, submittedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(draft.current));
    window.dispatchEvent(new Event(eventName));
    return draft.current;
  };
  return { pending, blocked: Boolean(stored), begin, finish };
}

export type SubmissionGuard = ReturnType<typeof useSubmissionGuard>;
