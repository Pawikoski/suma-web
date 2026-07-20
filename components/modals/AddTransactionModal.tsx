'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { createTransactionAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Account, Category } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

type TxType = 'expense' | 'income' | 'transfer';

const TYPE_LABELS: Record<TxType, string> = { expense: 'Wydatek', income: 'Przychód', transfer: 'Transfer' };
const TYPE_COLORS: Record<TxType, string> = { expense: T.expense, income: T.income, transfer: T.accent };

const NUMPAD = ['7', '8', '9', '⌫', '4', '5', '6', '↺', '1', '2', '3', null, 'currency', '0', '.', '✓'] as const;

function defaultDateForMonth(activeMonth: string): string {
  const today = new Date();
  if (activeMonth === 'all') return today.toISOString().slice(0, 10);
  const daysInMonth = new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate();
  return `${activeMonth}-${String(Math.min(today.getDate(), daysInMonth)).padStart(2, '0')}`;
}

interface AddTransactionModalProps {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
}

export default function AddTransactionModal({ onClose, accounts, categories }: AddTransactionModalProps) {
  const router = useRouter();
  const { activeMonth, baseCurrency } = useActiveMonthData();
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => defaultDateForMonth(activeMonth));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts.find(a => a.id !== accounts[0]?.id)?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [isPending, startTransition] = useTransition();

  const typeColor = TYPE_COLORS[type];
  const amountNumber = Number(amount);
  const account = accounts.find(a => a.id === accountId) ?? accounts[0] ?? null;
  const accountCurrency = account?.currency ?? baseCurrency;
  const toAccount = accounts.find(a => a.id === toAccountId) ?? null;
  const eligibleCategories = useMemo(() => {
    if (type === 'transfer') return [];
    const targetType = type === 'income' ? 'INCOME' : 'EXPENSE';
    return categories.filter(c => c.types.length === 0 || c.types.includes(targetType));
  }, [categories, type]);
  const category = eligibleCategories.find(c => c.id === categoryId) ?? eligibleCategories[0] ?? null;
  const effectiveToAccount = type === 'transfer'
    ? (toAccount && toAccount.id !== accountId ? toAccount : accounts.find(a => a.id !== accountId) ?? null)
    : null;

  const handleNum = (v: string) => {
    if (v === '⌫') { setAmount(a => a.length > 1 ? a.slice(0, -1) : '0'); return; }
    if (v === '↺') { setAmount('0'); return; }
    if (v === 'currency') return;
    if (v === '.' && amount.includes('.')) return;
    if (amount === '0' && v !== '.') { setAmount(v); return; }
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    setAmount(a => a + v);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await createTransactionAction({
        type,
        amount: amountNumber,
        date,
        accountId,
        toAccountId: effectiveToAccount?.id ?? null,
        categoryId: type === 'transfer' ? null : category?.id ?? null,
        note,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message ?? 'Zapisano transakcję.');
      onClose();
      router.refresh();
      if (result.id) router.push(`/transactions?id=${result.id}&month=${activeMonth}`);
    });
  };

  const canSubmit = amountNumber > 0 && !!account && (type === 'transfer' ? !!effectiveToAccount && effectiveToAccount.id !== account.id : !!category);

  return (
    <div className="add-transaction-overlay" role="dialog" aria-modal="true" aria-label="Nowa transakcja" style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <Card className="add-transaction-card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.dark }}>Nowa transakcja</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
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
            <div style={{ fontSize: 16, color: T.muted, marginTop: 4 }}>{accountCurrency}</div>
          </div>

          {/* Account & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <div style={{ background: T.incomeSoft, borderRadius: 10, padding: '10px 12px' }}>
              <label style={{ fontSize: 10, color: T.muted, fontWeight: 500, marginBottom: 4, display: 'block' }}>Konto</label>
              <select
                aria-label="Konto"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: T.dark, outline: 'none', fontFamily: 'inherit' }}
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: T.muted }}>{account ? <PrivacyAmount amount={account.balance} currency={account.currency} /> : ''}</div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.expenseSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.expense, fontSize: 16 }}>→</div>
            <div style={{ background: T.accentLight, borderRadius: 10, padding: '10px 12px' }}>
              <label style={{ fontSize: 10, color: T.muted, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                {type === 'transfer' ? 'Do konta' : 'Kategoria'}
              </label>
              {type === 'transfer' ? (
                <select
                  aria-label="Konto docelowe"
                  value={effectiveToAccount?.id ?? ''}
                  onChange={e => setToAccountId(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: T.dark, outline: 'none', fontFamily: 'inherit' }}
                >
                  {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                <select
                  aria-label="Kategoria"
                  value={category?.id ?? ''}
                  onChange={e => setCategoryId(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: T.dark, outline: 'none', fontFamily: 'inherit' }}
                >
                  {eligibleCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div style={{ fontSize: 11, color: T.muted }}>{type === 'transfer' ? (effectiveToAccount ? <PrivacyAmount amount={effectiveToAccount.balance} currency={effectiveToAccount.currency} /> : '') : (category ? <PrivacyAmount amount={category.spent} currency={accountCurrency} /> : '')}</div>
            </div>
          </div>

          <input
            aria-label="Data transakcji"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontSize: 13, color: T.dark, outline: 'none', fontFamily: 'inherit' }}
          />

          {/* Note */}
          <input
            aria-label="Notatka"
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
              const isSpecial = k === 'currency' || k === '⌫' || k === '↺';
              return (
                <button
                  key={k}
                  disabled={isPending || (k === '✓' && !canSubmit)}
                  onClick={() => k === '✓' ? submit() : handleNum(k)}
                  style={{
                    padding: '14px 0', borderRadius: T.radiusSm, fontSize: isConfirm ? 20 : 15, fontWeight: 600,
                    background: isConfirm ? T.accent : T.bg,
                    color: isConfirm ? 'white' : isSpecial ? T.muted : T.dark,
                    border: `1px solid ${isConfirm ? T.accent : T.border}`,
                    gridRow: isConfirm ? 'span 2' : 'auto',
                    cursor: isPending || (k === '✓' && !canSubmit) ? 'not-allowed' : 'pointer',
                    opacity: isPending || (k === '✓' && !canSubmit) ? 0.55 : 1,
                  }}
                >
                  {isConfirm && isPending ? '...' : k === 'currency' ? accountCurrency : k}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
