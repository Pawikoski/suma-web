'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, CheckCircle2, ClipboardList, Smartphone, Tags } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

function statusLabel(status: string | null) {
  if (!status) return 'Zapisane';
  if (status === 'PENDING') return 'Do weryfikacji';
  if (status === 'APPROVED') return 'Zatwierdzone';
  if (status === 'REJECTED') return 'Odrzucone';
  return status;
}

export default function AppNotificationReaderScreen() {
  const { allTransactions, activeMonth, baseCurrency } = useActiveMonthData();
  const parsedTransactions = allTransactions.filter(transaction => transaction.isFromNotificationParser);
  const visibleTransactions = parsedTransactions.filter(transaction => activeMonth === 'all' || transaction.date.startsWith(activeMonth));
  const pendingCount = visibleTransactions.filter(transaction => transaction.reviewStatus === 'PENDING').length;
  const parserKeys = new Set(visibleTransactions.map(transaction => transaction.parserNotificationKey).filter(Boolean));
  const totalAmount = visibleTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return (
    <div className="screen app-notification-reader-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Link href={`/settings?month=${activeMonth}`} style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.bg, color: T.mid, fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Ustawienia
        </Link>
        <Link href={`/transactions?month=${activeMonth}`} style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.dark, color: 'white', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          Transakcje
        </Link>
      </div>

      <Card style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: T.accentLight, display: 'grid', placeItems: 'center' }}>
            <Smartphone size={24} color={T.accent} />
          </div>
          <div>
            <h1 style={{ color: T.dark, fontSize: 22, fontWeight: 950 }}>Czytanie powiadomień bankowych</h1>
            <div style={{ color: T.muted, fontSize: 13, marginTop: 3 }}>Web pokazuje wynik synchronizacji z parsera Androida; włączenie dostępu do powiadomień odbywa się na telefonie.</div>
          </div>
        </div>
      </Card>

      <div className="app-notification-reader-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <SummaryCard icon={<Bell size={20} color={T.accent} />} label="Z parsera" value={visibleTransactions.length} />
        <SummaryCard icon={<ClipboardList size={20} color={T.warn} />} label="Do weryfikacji" value={pendingCount} />
        <SummaryCard icon={<Tags size={20} color={T.income} />} label="Źródła" value={parserKeys.size} />
        <Card style={{ padding: 16, minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.bg, display: 'grid', placeItems: 'center' }}>
            <CheckCircle2 size={20} color={T.income} />
          </div>
          <div>
            <PrivacyAmount amount={totalAmount} currency={baseCurrency} style={{ display: 'block', color: T.dark, fontSize: 20, fontWeight: 950 }} />
            <div style={{ color: T.muted, fontSize: 12, fontWeight: 800 }}>Kwota rozpoznana</div>
          </div>
        </Card>
      </div>

      <Card style={{ padding: 18 }}>
        <div style={{ color: T.dark, fontSize: 15, fontWeight: 900, marginBottom: 12 }}>Ostatnie rozpoznane transakcje</div>
        {visibleTransactions.length === 0 ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', color: T.faint, fontSize: 13, textAlign: 'center' }}>
            Brak transakcji utworzonych przez parser powiadomień w tym okresie
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleTransactions.slice(0, 20).map(transaction => (
              <Link
                key={transaction.id}
                href={`/transactions?id=${transaction.id}&month=${transaction.date.slice(0, 7)}`}
                style={{ minHeight: 58, borderRadius: T.radiusSm, background: T.bg, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', color: T.dark, fontSize: 13, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transaction.desc || transaction.cat}</span>
                  <span style={{ display: 'block', color: T.muted, fontSize: 11 }}>{transaction.date} · {transaction.acc} · {statusLabel(transaction.reviewStatus)}</span>
                </span>
                <PrivacyAmount amount={Math.abs(transaction.amount)} currency={transaction.currency} prefix={transaction.type === 'expense' ? '- ' : '+ '} style={{ color: transaction.type === 'expense' ? T.expense : T.income, fontSize: 13, fontWeight: 900 }} />
              </Link>
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
