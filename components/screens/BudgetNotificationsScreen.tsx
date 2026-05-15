'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Bell } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

export default function BudgetNotificationsScreen() {
  const { accountBudgets, accounts, categories, activeMonth, transactions } = useActiveMonthData();
  const categoryAlerts = categories
    .filter(category => category.budget && category.budget > 0)
    .map(category => {
      const pct = category.spent / category.budget! * 100;
      return {
        id: category.id,
        label: category.name,
        icon: category.icon,
        bg: category.bg,
        color: category.color,
        spent: category.spent,
        budget: category.budget!,
        pct,
        kind: 'category' as const,
      };
    });
  const accountAlerts = accountBudgets
    .map(budget => {
      const account = accounts.find(item => item.id === budget.accountId) ?? null;
      const spent = transactions
        .filter(transaction => transaction.type === 'expense' && transaction.accountId === budget.accountId)
        .reduce((sum, transaction) => sum + transaction.rawAmount, 0);
      const pct = budget.amount > 0 ? spent / budget.amount * 100 : 0;
      return {
        id: budget.id,
        label: budget.accountName ?? account?.name ?? 'Konto',
        icon: account?.icon ?? 'Wallet',
        bg: account?.color ?? T.bg,
        color: account?.color ?? T.accent,
        spent,
        budget: budget.amount,
        pct,
        kind: 'account' as const,
      };
    })
    .filter(item => item.budget > 0);
  const alerts = [...categoryAlerts, ...accountAlerts].sort((a, b) => b.pct - a.pct);
  const overLimit = alerts.filter(item => item.pct >= 100);
  const nearLimit = alerts.filter(item => item.pct >= 80 && item.pct < 100);
  const watched = alerts.length;

  return (
    <div className="screen budget-notifications-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Link href={`/settings?month=${activeMonth}`} style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.bg, color: T.mid, fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Ustawienia
        </Link>
        <Link href={`/budget?month=${activeMonth}`} style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.dark, color: 'white', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          Budżety
        </Link>
      </div>

      <div className="budget-notifications-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <SummaryCard icon={<Bell size={20} color={T.accent} />} label="Monitorowane budżety" value={watched} />
        <SummaryCard icon={<AlertTriangle size={20} color={T.warn} />} label="Blisko limitu" value={nearLimit.length} />
        <SummaryCard icon={<AlertTriangle size={20} color={T.expense} />} label="Przekroczone" value={overLimit.length} />
      </div>

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ color: T.dark, fontSize: 20, fontWeight: 900 }}>Alerty budżetowe</h1>
            <div style={{ color: T.muted, fontSize: 13 }}>{activeMonth === 'all' ? 'Wszystkie miesiące' : activeMonth}</div>
          </div>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 800, alignSelf: 'center' }}>80% / 100%</div>
        </div>

        {alerts.length === 0 ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', color: T.faint, fontSize: 13, textAlign: 'center' }}>
            Brak budżetów do monitorowania w tym miesiącu
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map(alert => (
              <div key={`${alert.kind}-${alert.id}`} style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: alert.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={alert.icon} size={18} color={alert.kind === 'account' ? 'white' : alert.color} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', color: T.dark, fontSize: 14, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.label}</span>
                    <span style={{ display: 'block', color: T.muted, fontSize: 11 }}>{alert.kind === 'account' ? 'Konto' : 'Kategoria'}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <PrivacyAmount amount={alert.spent} style={{ display: 'block', color: alert.pct >= 100 ? T.expense : T.dark, fontSize: 14, fontWeight: 900 }} />
                    <span style={{ display: 'block', color: T.faint, fontSize: 11 }}>z {fmtPLN(alert.budget)}</span>
                  </span>
                </div>
                <Bar pct={alert.pct} color={alert.pct >= 100 ? T.expense : alert.pct >= 80 ? T.warn : alert.color} height={7} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 7, color: alert.pct >= 100 ? T.expense : alert.pct >= 80 ? T.warn : T.income, fontSize: 12, fontWeight: 850 }}>
                  <span>{alert.pct >= 100 ? 'Próg przekroczony' : alert.pct >= 80 ? 'Blisko limitu' : 'W normie'}</span>
                  <span>{Math.round(alert.pct)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card style={{ padding: 16, minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.bg, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ color: T.dark, fontSize: 26, fontWeight: 950 }}>{value}</div>
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>{label}</div>
      </div>
    </Card>
  );
}
