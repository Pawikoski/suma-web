'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, HandCoins, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { T } from '@/lib/tokens';
import { Settlement } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

type SettlementFilter = 'active' | 'owedToMe' | 'iOwe' | 'settled';

const FILTERS: Array<{ id: SettlementFilter; label: string }> = [
  { id: 'active', label: 'Aktywne' },
  { id: 'owedToMe', label: 'Do odebrania' },
  { id: 'iOwe', label: 'Do spłaty' },
  { id: 'settled', label: 'Rozliczone' },
];

function isSettled(settlement: Settlement) {
  return settlement.status === 'SETTLED' || settlement.remainingAmount <= 0;
}

function filterSettlement(settlement: Settlement, filter: SettlementFilter) {
  if (filter === 'active') return settlement.status === 'ACTIVE' && settlement.remainingAmount > 0;
  if (filter === 'owedToMe') return settlement.direction === 'LENT' && settlement.remainingAmount > 0;
  if (filter === 'iOwe') return settlement.direction === 'BORROWED' && settlement.remainingAmount > 0;
  return isSettled(settlement);
}

export default function SettlementsScreen() {
  const { settlements } = useActiveMonthData();
  const [filter, setFilter] = useState<SettlementFilter>('active');
  const activeSettlements = settlements.filter(item => item.status === 'ACTIVE' && item.remainingAmount > 0);
  const owedToMe = activeSettlements
    .filter(item => item.direction === 'LENT')
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const iOwe = activeSettlements
    .filter(item => item.direction === 'BORROWED')
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const netBalance = owedToMe - iOwe;
  const overdueCount = activeSettlements.filter(item => item.isOverdue).length;
  const filteredSettlements = settlements.filter(item => filterSettlement(item, filter));
  const counts: Record<SettlementFilter, number> = {
    active: activeSettlements.length,
    owedToMe: activeSettlements.filter(item => item.direction === 'LENT').length,
    iOwe: activeSettlements.filter(item => item.direction === 'BORROWED').length,
    settled: settlements.filter(isSettled).length,
  };

  if (settlements.length === 0) {
    return (
      <div className="screen settlements-screen" style={{ minHeight: '100%', padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ maxWidth: 430, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: T.accentLight, display: 'grid', placeItems: 'center' }}>
            <HandCoins size={34} color={T.accent} />
          </div>
          <h1 style={{ fontSize: 24, color: T.dark, marginBottom: 8 }}>Brak rozliczeń</h1>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>Rozliczenia z aplikacji mobilnej pojawią się tutaj razem z kwotą pozostałą do spłaty i terminami.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen settlements-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="settlements-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: netBalance >= 0 ? T.incomeSoft : T.expenseSoft, borderColor: netBalance >= 0 ? '#a7f3d0' : '#fecaca' }}>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 850, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Bilans rozliczeń</div>
          <PrivacyAmount amount={netBalance} signed style={{ display: 'block', color: netBalance >= 0 ? T.income : T.expense, fontSize: 34, fontWeight: 850 }} />
          <div style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>{netBalance >= 0 ? 'Więcej pieniędzy jest do odebrania.' : 'Masz więcej do spłaty.'}</div>
        </Card>
        <MetricCard label="Do odebrania" value={owedToMe} color={T.income} />
        <MetricCard label="Do spłaty" value={iOwe} color={T.expense} />
        <MetricCard label="Przeterminowane" value={overdueCount} color={T.warn} numeric />
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(item => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: `1px solid ${filter === item.id ? T.accent : T.border}`,
              background: filter === item.id ? T.accent : T.card,
              color: filter === item.id ? 'white' : T.mid,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {item.label} {counts[item.id]}
          </button>
        ))}
      </div>

      <div className="settlements-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filteredSettlements.map(settlement => (
          <SettlementCard key={settlement.id} settlement={settlement} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, numeric = false }: { label: string; value: number; color: string; numeric?: boolean }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 126 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>
        {numeric ? <AlertTriangle size={20} color={color} /> : <HandCoins size={20} color={color} />}
      </div>
      <div>
        {numeric ? (
          <div style={{ color, fontSize: 26, fontWeight: 850 }}>{value}</div>
        ) : (
          <PrivacyAmount amount={value} style={{ display: 'block', color, fontSize: 24, fontWeight: 850 }} />
        )}
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>{label}</div>
      </div>
    </Card>
  );
}

function SettlementCard({ settlement }: { settlement: Settlement }) {
  const isLent = settlement.direction === 'LENT';
  const settled = isSettled(settlement);
  const amountColor = settled ? T.muted : isLent ? T.income : T.expense;
  const dueLabel = settlement.dueDate
    ? format(parseISO(settlement.dueDate), 'd MMMM yyyy', { locale: pl })
    : 'Bez terminu';

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: isLent ? T.incomeSoft : T.expenseSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {settled ? <CheckCircle2 size={22} color={T.muted} /> : isLent ? <Send size={22} color={T.income} /> : <HandCoins size={22} color={T.expense} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settlement.counterpartyName}</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{isLent ? 'Ty pożyczyłeś pieniądze' : 'Pożyczyłeś od tej osoby'}</div>
          {settlement.note && <div style={{ color: T.faint, fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settlement.note}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <PrivacyAmount amount={isLent ? settlement.remainingAmount : -settlement.remainingAmount} signed style={{ display: 'block', color: amountColor, fontSize: 16, fontWeight: 850 }} />
          <div style={{ color: T.faint, fontSize: 11 }}>z {settlement.totalAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {settlement.currency}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: settlement.isOverdue ? T.expense : T.muted, fontSize: 12, fontWeight: 750 }}>
          <Clock size={14} /> {settlement.isOverdue ? `${dueLabel} · po terminie` : dueLabel}
        </div>
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{settlement.payments.length} wpłat</div>
      </div>
    </Card>
  );
}
