'use client';
import { T } from '@/lib/tokens';
import { TransactionType } from '@/lib/data';

const cfg: Record<TransactionType, { bg: string; color: string; label: string }> = {
  expense:  { bg: T.expenseSoft, color: T.expense, label: 'Wydatek' },
  income:   { bg: T.incomeSoft,  color: T.income,  label: 'Przychód' },
  transfer: { bg: T.accentLight, color: T.accent,  label: 'Transfer' },
};

export default function Badge({ type }: { type: TransactionType }) {
  const c = cfg[type];
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>
      {c.label}
    </span>
  );
}
