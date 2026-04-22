'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, X } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { Transaction } from '@/lib/data';
import { useAppData } from '@/lib/AppDataContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import { useState } from 'react';

function TxDetailPanel({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const amtColor = tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.dark }}>Szczegóły</div>
        <button onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <Card style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Icon name={tx.catIcon} size={26} color={tx.catColor} />
        </div>
        <Badge type={tx.type} />
        <div style={{ fontSize: 28, fontWeight: 800, color: amtColor, marginTop: 8, letterSpacing: '-1px' }}>
          {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmtPLN(Math.abs(tx.amount))}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{tx.cat}</div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {([
          { label: 'Data', value: tx.date.split('-').reverse().join('.') },
          { label: 'Konto', value: tx.acc },
          tx.desc ? { label: 'Opis', value: tx.desc } : null,
          tx.loc ? { label: 'Miejsce', value: tx.loc } : null,
        ].filter(Boolean) as { label: string; value: string }[]).map((row, i, arr) => (
          <div key={row.label} style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize: 12, color: T.muted }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.mid }}>{row.value}</span>
          </div>
        ))}
      </Card>

      {tx.loc && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: T.radiusSm, background: T.bg, fontSize: 12, color: T.muted }}>
          <MapPin size={13} color={T.accent} />
          {tx.loc}
        </div>
      )}
    </div>
  );
}

export default function TransactionsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { transactions } = useAppData();
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');

  const selectedId = searchParams.get('id');
  const selectedTx = selectedId ? transactions.find(t => t.id === selectedId) ?? null : null;

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter);

  const selectTx = (tx: Transaction) => router.replace(`/transactions?id=${tx.id}`);
  const deselectTx = () => router.replace('/transactions');

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['all', 'expense', 'income'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                background: filter === f ? T.dark : 'transparent',
                color: filter === f ? 'white' : T.muted,
                border: `1px solid ${filter === f ? T.dark : T.border}`,
                transition: 'all .15s', cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'Wszystkie' : f === 'expense' ? 'Wydatki' : 'Przychody'}
            </button>
          ))}
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: T.faint }}>Brak transakcji</div>
          )}
          {filtered.map((tx, i) => (
            <div
              key={tx.id}
              onClick={() => selectTx(tx)}
              style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                cursor: 'pointer', background: selectedTx?.id === tx.id ? T.accentLight : 'transparent',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (selectedTx?.id !== tx.id) e.currentTarget.style.background = T.bg; }}
              onMouseLeave={e => { if (selectedTx?.id !== tx.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tx.catIcon} size={18} color={tx.catColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{tx.cat}</div>
                <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.desc || tx.loc || tx.acc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
                  {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmtPLN(Math.abs(tx.amount))}
                </div>
                <div style={{ fontSize: 11, color: T.faint }}>{tx.date.slice(5).replace('-', '.')}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {selectedTx && (
        <div style={{ width: 300, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', background: T.card }}>
          <TxDetailPanel tx={selectedTx} onClose={deselectTx} />
        </div>
      )}
    </div>
  );
}
