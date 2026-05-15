'use client';

import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, BriefcaseBusiness, Coins, LineChart } from 'lucide-react';
import { T } from '@/lib/tokens';
import { InvestmentHolding, InvestmentType } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const TYPE_META: Record<InvestmentType, { label: string; color: string; bg: string }> = {
  STOCK: { label: 'Akcje', color: '#3B82F6', bg: '#DBEAFE' },
  ETF: { label: 'ETF', color: '#10B981', bg: '#D1FAE5' },
  CRYPTO: { label: 'Krypto', color: '#F59E0B', bg: '#FEF3C7' },
  PRECIOUS_METAL: { label: 'Metale', color: '#D97706', bg: '#FEF3C7' },
};

function formatQuantity(value: number) {
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 8 });
}

export default function InvestmentsScreen() {
  const { investmentHoldings, accounts } = useActiveMonthData();
  const [accountId, setAccountId] = useState('all');
  const investmentAccounts = accounts.filter(account => account.rawType === 'INVESTMENT');
  const filtered = accountId === 'all'
    ? investmentHoldings
    : investmentHoldings.filter(holding => holding.accountId === accountId);
  const totalValue = filtered.reduce((sum, holding) => sum + holding.value, 0);
  const transactionCount = filtered.reduce((sum, holding) => sum + holding.transactions.length, 0);
  const byType = useMemo(() => {
    const result = new Map<InvestmentType, number>();
    for (const holding of filtered) result.set(holding.investmentType, (result.get(holding.investmentType) ?? 0) + holding.value);
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  if (investmentHoldings.length === 0) {
    return (
      <div className="screen investments-screen" style={{ minHeight: '100%', padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ maxWidth: 430, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: T.accentLight, display: 'grid', placeItems: 'center' }}>
            <LineChart size={34} color={T.accent} />
          </div>
          <h1 style={{ fontSize: 24, color: T.dark, marginBottom: 8 }}>Brak inwestycji</h1>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>Portfel inwestycyjny z aplikacji mobilnej pojawi się tutaj razem z pozycjami, wyceną i historią operacji.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen investments-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="investments-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: T.card }}>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 850, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Wartość portfela</div>
          <PrivacyAmount amount={totalValue} style={{ display: 'block', color: T.dark, fontSize: 34, fontWeight: 850 }} />
          <div style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>{filtered.length} pozycji w wybranym zakresie</div>
        </Card>
        <MetricCard icon={<BriefcaseBusiness size={20} color={T.accent} />} label="Konta inwestycyjne" value={investmentAccounts.length} />
        <MetricCard icon={<Coins size={20} color={T.warn} />} label="Operacje" value={transactionCount} />
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => setAccountId('all')} style={chipStyle(accountId === 'all')}>Wszystkie</button>
        {investmentAccounts.map(account => (
          <button key={account.id} onClick={() => setAccountId(account.id)} style={chipStyle(accountId === account.id)}>
            {account.name}
          </button>
        ))}
      </div>

      <div className="investments-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map(holding => <HoldingCard key={holding.id} holding={holding} />)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, marginBottom: 14 }}>Struktura portfela</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byType.map(([type, value]) => {
                const meta = TYPE_META[type];
                const pct = totalValue > 0 ? value / totalValue * 100 : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                      <span style={{ color: T.mid, fontSize: 13, fontWeight: 750 }}>{meta.label}</span>
                      <span style={{ color: T.dark, fontSize: 13, fontWeight: 850 }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: T.bg, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, marginBottom: 14 }}>Ostatnie operacje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered
                .flatMap(holding => holding.transactions.map(tx => ({ tx, holding })))
                .sort((a, b) => b.tx.date.localeCompare(a.tx.date))
                .slice(0, 8)
                .map(({ tx, holding }) => (
                  <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: tx.type === 'BUY' ? T.incomeSoft : T.expenseSoft, display: 'grid', placeItems: 'center' }}>
                      {tx.type === 'BUY' ? <ArrowDownCircle size={17} color={T.income} /> : <ArrowUpCircle size={17} color={T.expense} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.dark, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.symbol}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{tx.date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: tx.type === 'BUY' ? T.income : T.expense, fontSize: 12, fontWeight: 850 }}>{tx.type === 'BUY' ? 'Kupno' : 'Sprzedaż'}</div>
                      <div style={{ color: T.faint, fontSize: 11 }}>{formatQuantity(tx.quantity)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 126 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ color: T.dark, fontSize: 26, fontWeight: 850 }}>{value}</div>
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>{label}</div>
      </div>
    </Card>
  );
}

function HoldingCard({ holding }: { holding: InvestmentHolding }) {
  const meta = TYPE_META[holding.investmentType];
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: meta.bg, color: meta.color, display: 'grid', placeItems: 'center', fontWeight: 900 }}>
          {holding.symbol.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.symbol}</div>
          <div style={{ color: T.muted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.name}</div>
          <div style={{ color: T.faint, fontSize: 12, marginTop: 5 }}>{holding.accountName ?? 'Bez konta'} · {meta.label}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <PrivacyAmount amount={holding.value} style={{ display: 'block', color: T.dark, fontSize: 16, fontWeight: 850 }} />
          <div style={{ color: T.faint, fontSize: 11 }}>{holding.currency}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ color: T.faint, fontSize: 11, fontWeight: 750 }}>Ilość</div>
          <div style={{ color: T.mid, fontSize: 13, fontWeight: 850 }}>{formatQuantity(holding.quantity)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: T.faint, fontSize: 11, fontWeight: 750 }}>Cena</div>
          <PrivacyAmount amount={holding.unitPrice} style={{ color: T.mid, fontSize: 13, fontWeight: 850 }} />
        </div>
      </div>
    </Card>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accent : T.card,
    color: active ? 'white' : T.mid,
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  };
}
