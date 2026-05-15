'use client';
import { CSSProperties, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { CalendarClock, ClipboardList, Pencil, Percent, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createAccountAction, deleteAccountAction, updateAccountAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { Account, AccountInterest } from '@/lib/data';
import Card from '@/components/ui/Card';
import Sparkline from '@/components/ui/Sparkline';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

export default function AccountsScreen() {
  const router = useRouter();
  const { accounts, transactions, accountInterest, activeMonth } = useActiveMonthData();
  const [selectedAccountId, setSelectedAccountId] = useQueryState('account', parseAsString.withDefault(accounts[0]?.id ?? ''));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const selected = useMemo(
    () => accounts.find(account => account.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId]
  );

  const totalBalance = accounts.filter(a => a.includeInNetWorth).reduce((s, a) => s + a.balance, 0);

  const accTxs = selected ? transactions.filter(t => t.acc === selected.name) : [];
  const accIncome = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const accExpense = Math.abs(accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const selectedInterest = selected ? accountInterest.find(interest => interest.accountId === selected.id) ?? null : null;

  return (
    <div className="screen accounts-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Łączny majątek</div>
          <PrivacyAmount amount={totalBalance} style={{ display: 'block', fontSize: 28, fontWeight: 800, color: T.dark }} />
        </div>
        <button aria-label="Dodaj konto" onClick={() => setIsCreateOpen(true)} style={primaryButtonStyle}>
          <Plus size={16} color="white" /> Dodaj konto
        </button>
      </div>

      <div className="account-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {accounts.map(a => (
          <Card
            key={a.id}
            onClick={() => void setSelectedAccountId(a.id)}
            style={{
              padding: 18, cursor: 'pointer',
              background: selected?.id === a.id ? `linear-gradient(135deg,${a.color},${a.color2})` : 'white',
              border: selected?.id === a.id ? 'none' : `1px solid ${T.border}`,
              transition: 'all .2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === a.id ? 'rgba(255,255,255,.9)' : T.mid }}>{a.name}</div>
              <Icon name={a.icon} size={20} color={selected?.id === a.id ? 'rgba(255,255,255,.85)' : a.color} />
            </div>
            <PrivacyAmount amount={a.balance} style={{ display: 'block', fontSize: 20, fontWeight: 800, color: selected?.id === a.id ? 'white' : T.dark }} />
            <div style={{ fontSize: 11, color: selected?.id === a.id ? 'rgba(255,255,255,.65)' : T.faint, marginTop: 4 }}>{a.type}</div>
          </Card>
        ))}
      </div>

      {selected && (
        <div className="accounts-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontWeight: 600, fontSize: 14, color: T.dark }}>
              Historia — {selected.name}
            </div>
            {accTxs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: T.faint }}>
                <ClipboardList size={32} color={T.faint} />
                <div style={{ marginTop: 10, fontSize: 13 }}>Brak transakcji</div>
              </div>
            )}
            {accTxs.map((tx, i) => (
              <div
                key={tx.id}
                onClick={() => router.push(`/transactions?id=${tx.id}&month=${activeMonth}`)}
                style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < accTxs.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={tx.catIcon} size={18} color={tx.catColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{tx.cat}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{tx.desc || tx.loc || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
                    <PrivacyAmount amount={Math.abs(tx.amount)} prefix={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} style={{ font: 'inherit' }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.faint }}>{tx.date.slice(5).replace('-', '.')}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.dark }}>Statystyki konta</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button aria-label="Edytuj konto" onClick={() => setEditingAccount(selected)} style={iconButtonStyle}>
                  <Pencil size={15} />
                </button>
                <DeleteAccountButton account={selected} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedInterest && <AccountInterestCard interest={selectedInterest} currency={selected.currency} />}
              <div style={{ padding: 14, borderRadius: 10, background: T.incomeSoft }}>
                <div style={{ fontSize: 12, color: T.income, fontWeight: 500 }}>Przychody</div>
                <PrivacyAmount amount={accIncome} prefix="+" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: T.income }} />
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: T.expenseSoft }}>
                <div style={{ fontSize: 12, color: T.expense, fontWeight: 500 }}>Wydatki</div>
                <PrivacyAmount amount={accExpense} prefix="-" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: T.expense }} />
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: T.bg }}>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Bilans</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: accIncome - accExpense >= 0 ? T.income : T.expense }}>
                  <PrivacyAmount amount={accIncome - accExpense} signed style={{ font: 'inherit' }} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Sparkline color={T.accent} />
            </div>
          </Card>
        </div>
      )}
      {isCreateOpen && <AccountFormModal onClose={() => setIsCreateOpen(false)} />}
      {editingAccount && <AccountFormModal account={editingAccount} onClose={() => setEditingAccount(null)} />}
    </div>
  );
}

function DeleteAccountButton({ account }: { account: Account }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const deleteAccount = () => {
    if (!window.confirm('Usunąć konto z listy? Historia transakcji zostanie zachowana.')) return;

    startTransition(async () => {
      const result = await deleteAccountAction(account.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <button aria-label="Usuń konto" onClick={deleteAccount} disabled={isPending} style={{ ...iconButtonStyle, color: T.expense, background: T.expenseSoft, opacity: isPending ? 0.55 : 1 }}>
      <Trash2 size={15} />
    </button>
  );
}

function AccountInterestCard({ interest, currency }: { interest: AccountInterest; currency: string }) {
  const start = new Date(`${interest.startDate}T00:00:00`);
  const end = new Date(`${interest.endDate}T00:00:00`);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((now.getTime() - start.getTime()) / dayMs)));
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const grossAccrued = interest.effectiveBaseAmount * interest.annualRatePercent / 100 / 365 * elapsedDays;
  const netAccrued = grossAccrued * (1 - interest.taxRatePercent / 100);
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, elapsedDays / totalDays * 100)) : 0;
  const isLoan = interest.monthlyPayment !== null || interest.originalLoanAmount !== null;

  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 750, opacity: 0.78 }}>{isLoan ? 'Oprocentowanie zobowiązania' : 'Aktywne oprocentowanie'}</div>
          <div style={{ fontSize: 16, fontWeight: 850 }}>{interest.annualRatePercent.toFixed(2)}% rocznie</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 999, background: 'rgba(255,255,255,.16)', fontSize: 12, fontWeight: 850 }}>
          <Percent size={14} /> {interest.taxRatePercent.toFixed(0)}% podatku
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Naliczono netto</div>
          <PrivacyAmount amount={netAccrued} prefix="+" style={{ display: 'block', fontSize: 18, fontWeight: 850 }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Baza</div>
          <PrivacyAmount amount={interest.effectiveBaseAmount} style={{ display: 'block', fontSize: 18, fontWeight: 850 }} />
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.2)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'white' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 750, opacity: 0.78 }}>
        <span>{interest.startDate}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CalendarClock size={13} /> {daysLeft === 0 ? 'zakończone' : `${daysLeft} dni`}
        </span>
        <span>{interest.endDate}</span>
      </div>
      {interest.afterMaturityAction === 'TRANSFER' && interest.targetAccountName && (
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.82 }}>Po zapadalności transfer na: {interest.targetAccountName}</div>
      )}
      {interest.monthlyPayment !== null && (
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.82 }}>Rata miesięczna: {interest.monthlyPayment.toLocaleString('pl-PL', { style: 'currency', currency })}</div>
      )}
    </div>
  );
}

function AccountFormModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<'CASH' | 'BANK' | 'PROPERTY' | 'INVESTMENT'>((account?.rawType as 'CASH' | 'BANK' | 'PROPERTY' | 'INVESTMENT') ?? 'BANK');
  const [category, setCategory] = useState<'BASIC' | 'SAVINGS' | 'LIABILITY'>((account?.category as 'BASIC' | 'SAVINGS' | 'LIABILITY') ?? 'BASIC');
  const [balance, setBalance] = useState(account ? String(account.balance.toFixed(2)) : '0.00');
  const [currency, setCurrency] = useState(account?.currency ?? 'PLN');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(account?.includeInNetWorth ?? true);
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const amountValue = Number(balance);
  const availableCategories = categoryOptions(type);
  const effectiveCategory = availableCategories.some(item => item.value === category) ? category : 'BASIC';
  const canSubmit = name.trim().length > 0 && Number.isFinite(amountValue) && currency.trim().length >= 3;

  const submit = () => {
    startTransition(async () => {
      const payload = {
        id: account?.id,
        name,
        type,
        category: effectiveCategory,
        balance: amountValue,
        currency,
        includeInNetWorth,
        notes,
      };
      const result = account ? await updateAccountAction(payload) : await createAccountAction(payload);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
      if (result.id) router.push(`/accounts?account=${result.id}`);
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={account ? 'Edycja konta' : 'Nowe konto'} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <Card style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 850, fontSize: 16, color: T.dark }}>{account ? 'Edycja konta' : 'Nowe konto'}</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <input aria-label="Nazwa konta" placeholder="Nazwa" value={name} onChange={event => setName(event.target.value)} style={inputStyle} />
          <select aria-label="Typ konta" value={type} onChange={event => { setType(event.target.value as typeof type); setCategory('BASIC'); }} style={inputStyle}>
            <option value="CASH">Gotówka</option>
            <option value="BANK">Konto bankowe</option>
            <option value="PROPERTY">Majątek</option>
            <option value="INVESTMENT">Inwestycje</option>
          </select>
          <select aria-label="Kategoria konta" value={effectiveCategory} onChange={event => setCategory(event.target.value as typeof category)} style={inputStyle}>
            {availableCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <input aria-label="Saldo konta" type="number" step="0.01" value={balance} onChange={event => setBalance(event.target.value)} style={inputStyle} />
            <input aria-label="Waluta konta" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} style={inputStyle} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.mid, fontSize: 13, fontWeight: 750 }}>
            <input type="checkbox" checked={includeInNetWorth} onChange={event => setIncludeInNetWorth(event.target.checked)} />
            Wliczaj do majątku
          </label>
          <input aria-label="Notatka konta" placeholder="Notatka" value={notes} onChange={event => setNotes(event.target.value)} style={inputStyle} />
          <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
            <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz konto'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function categoryOptions(type: 'CASH' | 'BANK' | 'PROPERTY' | 'INVESTMENT') {
  if (type === 'BANK') {
    return [
      { value: 'BASIC', label: 'Podstawowe' },
      { value: 'SAVINGS', label: 'Oszczędnościowe' },
      { value: 'LIABILITY', label: 'Zobowiązanie' },
    ] as const;
  }
  if (type === 'INVESTMENT') return [{ value: 'BASIC', label: 'Podstawowe' }] as const;
  return [
    { value: 'BASIC', label: 'Podstawowe' },
    { value: 'LIABILITY', label: 'Zobowiązanie' },
  ] as const;
}

const inputStyle: CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: T.radiusSm,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.dark,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: T.radiusSm,
  background: T.accent,
  color: 'white',
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 40,
  padding: '0 16px',
  cursor: 'pointer',
};

const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  borderRadius: 8,
  background: T.accentLight,
  color: T.accent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
