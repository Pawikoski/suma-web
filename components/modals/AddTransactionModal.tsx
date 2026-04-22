'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { Account, Category } from '@/lib/data';
import Card from '@/components/ui/Card';

type TxType = 'expense' | 'income' | 'transfer';

const TYPE_LABELS: Record<TxType, string> = { expense: 'Wydatek', income: 'Przychód', transfer: 'Transfer' };
const TYPE_COLORS: Record<TxType, string> = { expense: T.expense, income: T.income, transfer: T.accent };

const NUMPAD = ['7', '8', '9', '⌫', '4', '5', '6', '↺', '1', '2', '3', null, 'PLN', '0', '.', '✓'] as const;

interface AddTransactionModalProps {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
}

export default function AddTransactionModal({ onClose, accounts, categories }: AddTransactionModalProps) {
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('0');
  const [cat, setCat] = useState(categories[0] ?? null);
  const [acc, setAcc] = useState(accounts[0] ?? null);
  const [note, setNote] = useState('');

  const typeColor = TYPE_COLORS[type];

  const handleNum = (v: string) => {
    if (v === '⌫') { setAmount(a => a.length > 1 ? a.slice(0, -1) : '0'); return; }
    if (v === '.' && amount.includes('.')) return;
    if (amount === '0' && v !== '.') { setAmount(v); return; }
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    setAmount(a => a + v);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <Card style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.dark }}>Nowa transakcja</div>
          <button onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, background: T.bg, borderRadius: T.radiusSm, padding: 4 }}>
            {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1, padding: '6px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: type === t ? T.card : 'transparent',
                  color: type === t ? TYPE_COLORS[t] : T.muted,
                  boxShadow: type === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                  transition: 'all .15s', border: 'none', cursor: 'pointer',
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Amount display */}
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: typeColor, letterSpacing: '-2px', lineHeight: 1 }}>{amount}</div>
            <div style={{ fontSize: 16, color: T.muted, marginTop: 4 }}>PLN</div>
          </div>

          {/* Account & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <div style={{ background: T.incomeSoft, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 500, marginBottom: 2 }}>Konto</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.dark }}>{acc ? `${acc.icon} ${acc.name}` : '—'}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{acc ? fmtPLN(acc.balance) : ''}</div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.expenseSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.expense, fontSize: 16 }}>→</div>
            <div style={{ background: T.accentLight, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 500, marginBottom: 2 }}>Kategoria</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.dark }}>{cat ? `${cat.icon} ${cat.name}` : '—'}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{cat ? fmtPLN(cat.spent) : ''}</div>
            </div>
          </div>

          {/* Note */}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Dodaj notatkę..."
            style={{ padding: '10px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontSize: 13, color: T.dark, outline: 'none', fontFamily: 'inherit' }}
          />

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {NUMPAD.map((k, i) => {
              if (k === null) return <div key={i} />;
              const isConfirm = k === '✓';
              const isSpecial = k === 'PLN' || k === '⌫' || k === '↺';
              return (
                <button
                  key={k}
                  onClick={() => k === '✓' ? onClose() : handleNum(k)}
                  style={{
                    padding: '14px 0', borderRadius: T.radiusSm, fontSize: isConfirm ? 20 : 15, fontWeight: 600,
                    background: isConfirm ? T.accent : T.bg,
                    color: isConfirm ? 'white' : isSpecial ? T.muted : T.dark,
                    border: `1px solid ${isConfirm ? T.accent : T.border}`,
                    gridRow: isConfirm ? 'span 2' : 'auto',
                    cursor: 'pointer',
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
