'use client';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';

interface StatPillProps {
  label: string;
  amount: number;
  type: 'income' | 'expense';
}

export default function StatPill({ label, amount, type }: StatPillProps) {
  const isIncome = type === 'income';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: isIncome ? T.incomeSoft : T.expenseSoft,
      borderRadius: 20, padding: '5px 12px',
    }}>
      <span style={{ fontSize: 13, color: isIncome ? T.income : T.expense }}>{isIncome ? '↑' : '↓'}</span>
      <div>
        <div style={{ fontSize: 10, color: isIncome ? T.income : T.expense, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: isIncome ? T.income : T.expense }}>{fmtPLN(amount)}</div>
      </div>
    </div>
  );
}
