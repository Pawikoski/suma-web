'use client';
import { T } from '@/lib/tokens';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

interface StatPillProps {
  label: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
}

export default function StatPill({ label, amount, currency, type }: StatPillProps) {
  const isIncome = type === 'income';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: isIncome ? T.incomeSoft : T.expenseSoft,
      borderRadius: 20, padding: '7px 14px',
    }}>
      <span style={{ fontSize: 15, color: isIncome ? T.income : T.expense }}>{isIncome ? '↑' : '↓'}</span>
      <div>
        <div style={{ fontSize: 12, color: isIncome ? T.income : T.expense, fontWeight: 500 }}>{label}</div>
        <PrivacyAmount amount={amount} currency={currency} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: isIncome ? T.income : T.expense }} />
      </div>
    </div>
  );
}
