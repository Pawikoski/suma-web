'use client';

import { CSSProperties, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, HandCoins, Plus, Save, Send, Trash2, WalletCards, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import { addSettlementPaymentAction, createSettlementAction, deleteSettlementAction, settleSettlementAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Account, Settlement } from '@/lib/data';
import { formatMoney } from '@/lib/utils';
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
  const { settlements, accounts, baseCurrency } = useActiveMonthData();
  const [filter, setFilter] = useState<SettlementFilter>('active');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [paymentSettlement, setPaymentSettlement] = useState<Settlement | null>(null);
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
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 18 }}>Rozliczenia z aplikacji mobilnej pojawią się tutaj razem z kwotą pozostałą do spłaty i terminami.</p>
          <button onClick={() => setIsCreateOpen(true)} style={primaryButtonStyle}>
            <Plus size={16} color="white" /> Dodaj rozliczenie
          </button>
        </div>
        {isCreateOpen && <SettlementFormModal accounts={accounts} onClose={() => setIsCreateOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="screen settlements-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="settlements-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: netBalance >= 0 ? T.incomeSoft : T.expenseSoft, borderColor: netBalance >= 0 ? '#a7f3d0' : '#fecaca' }}>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 850, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Bilans rozliczeń</div>
          <PrivacyAmount amount={netBalance} currency={baseCurrency} signed style={{ display: 'block', color: netBalance >= 0 ? T.income : T.expense, fontSize: 34, fontWeight: 850 }} />
          <div style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>{netBalance >= 0 ? 'Więcej pieniędzy jest do odebrania.' : 'Masz więcej do spłaty.'}</div>
        </Card>
        <MetricCard label="Do odebrania" value={owedToMe} currency={baseCurrency} color={T.income} />
        <MetricCard label="Do spłaty" value={iOwe} currency={baseCurrency} color={T.expense} />
        <MetricCard label="Przeterminowane" value={overdueCount} color={T.warn} numeric />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
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
        <button aria-label="Dodaj rozliczenie" onClick={() => setIsCreateOpen(true)} style={{ ...primaryButtonStyle, height: 36, padding: '0 14px', flexShrink: 0 }}>
          <Plus size={16} color="white" /> Dodaj
        </button>
      </div>

      <div className="settlements-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filteredSettlements.map(settlement => (
          <SettlementCard key={settlement.id} settlement={settlement} accounts={accounts} onPay={() => setPaymentSettlement(settlement)} />
        ))}
      </div>
      {isCreateOpen && <SettlementFormModal accounts={accounts} onClose={() => setIsCreateOpen(false)} />}
      {paymentSettlement && <PaymentModal settlement={paymentSettlement} accounts={accounts} onClose={() => setPaymentSettlement(null)} />}
    </div>
  );
}

function MetricCard({ label, value, currency, color, numeric = false }: { label: string; value: number; currency?: string; color: string; numeric?: boolean }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 126 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>
        {numeric ? <AlertTriangle size={20} color={color} /> : <HandCoins size={20} color={color} />}
      </div>
      <div>
        {numeric ? (
          <div style={{ color, fontSize: 26, fontWeight: 850 }}>{value}</div>
        ) : (
          <PrivacyAmount amount={value} currency={currency as string} style={{ display: 'block', color, fontSize: 24, fontWeight: 850 }} />
        )}
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>{label}</div>
      </div>
    </Card>
  );
}

function SettlementCard({ settlement, accounts, onPay }: { settlement: Settlement; accounts: Account[]; onPay: () => void }) {
  const router = useRouter();
  const [isSettling, startSettleTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const isLent = settlement.direction === 'LENT';
  const settled = isSettled(settlement);
  const amountColor = settled ? T.muted : isLent ? T.income : T.expense;
  const dueLabel = settlement.dueDate
    ? format(parseISO(settlement.dueDate), 'd MMMM yyyy', { locale: pl })
    : 'Bez terminu';
  const paymentAccounts = accounts.filter(account => account.currency === settlement.currency && !account.deletedAt);
  const defaultAccountId = settlement.accountId && paymentAccounts.some(account => account.id === settlement.accountId)
    ? settlement.accountId
    : paymentAccounts[0]?.id ?? '';

  const settle = () => {
    startSettleTransition(async () => {
      const result = await settleSettlementAction({
        settlementId: settlement.id,
        accountId: defaultAccountId,
        paidAt: new Date().toISOString().slice(0, 10),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  };
  const deleteSettlement = () => {
    if (!window.confirm('Usunąć rozliczenie i powiązane transakcje?')) return;

    startDeleteTransition(async () => {
      const result = await deleteSettlementAction(settlement.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  };

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
          <PrivacyAmount amount={isLent ? settlement.remainingAmount : -settlement.remainingAmount} currency={settlement.currency} signed style={{ display: 'block', color: amountColor, fontSize: 16, fontWeight: 850 }} />
          <div style={{ color: T.faint, fontSize: 11 }}>z {formatMoney(settlement.totalAmount, settlement.currency)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: settlement.isOverdue ? T.expense : T.muted, fontSize: 12, fontWeight: 750 }}>
          <Clock size={14} /> {settlement.isOverdue ? `${dueLabel} · po terminie` : dueLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{settlement.payments.length} wpłat</div>
          {!settled && (
            <button onClick={onPay} style={smallButtonStyle}>
              <WalletCards size={14} /> Wpłata
            </button>
          )}
          {!settled && (
            <button onClick={settle} disabled={isSettling || !defaultAccountId} style={{ ...smallButtonStyle, background: T.incomeSoft, color: T.income, opacity: isSettling || !defaultAccountId ? 0.55 : 1 }}>
              <CheckCircle2 size={14} /> {isSettling ? '...' : 'Do zera'}
            </button>
          )}
          <button aria-label={`Usuń rozliczenie ${settlement.counterpartyName}`} onClick={deleteSettlement} disabled={isDeleting} style={{ ...smallButtonStyle, background: T.expenseSoft, color: T.expense, width: 30, padding: 0, opacity: isDeleting ? 0.55 : 1 }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function SettlementFormModal({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const router = useRouter();
  const availableAccounts = accounts.filter(account => !account.deletedAt);
  const [direction, setDirection] = useState<'LENT' | 'BORROWED'>('LENT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDate);
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState(availableAccounts[0]?.id ?? '');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const amountValue = Number(amount);
  const canSubmit = Number.isFinite(amountValue) && amountValue >= 0.01 && !!accountId && counterpartyName.trim().length > 0;

  const submit = () => {
    startTransition(async () => {
      const result = await createSettlementAction({
        direction,
        amount: amountValue,
        date,
        dueDate: dueDate || null,
        accountId,
        counterpartyName,
        counterpartyEmail,
        note,
        reminderDaysBefore: 1,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  return (
    <ModalFrame title="Nowe rozliczenie" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Segmented
          value={direction}
          options={[
            { value: 'LENT', label: 'Do odebrania' },
            { value: 'BORROWED', label: 'Do spłaty' },
          ]}
          onChange={setDirection}
        />
        <input aria-label="Osoba rozliczenia" placeholder="Osoba" value={counterpartyName} onChange={event => setCounterpartyName(event.target.value)} style={inputStyle} />
        <input aria-label="Kwota rozliczenia" placeholder="Kwota" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={inputStyle} />
        <select aria-label="Konto rozliczenia" value={accountId} onChange={event => setAccountId(event.target.value)} style={inputStyle}>
          {availableAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input aria-label="Data rozliczenia" type="date" value={date} onChange={event => setDate(event.target.value)} style={inputStyle} />
          <input aria-label="Termin rozliczenia" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} style={inputStyle} />
        </div>
        <input aria-label="Email osoby" placeholder="Email" value={counterpartyEmail} onChange={event => setCounterpartyEmail(event.target.value)} style={inputStyle} />
        <input aria-label="Notatka rozliczenia" placeholder="Notatka" value={note} onChange={event => setNote(event.target.value)} style={inputStyle} />
        <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
          <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz rozliczenie'}
        </button>
      </div>
    </ModalFrame>
  );
}

function PaymentModal({ settlement, accounts, onClose }: { settlement: Settlement; accounts: Account[]; onClose: () => void }) {
  const router = useRouter();
  const paymentAccounts = accounts.filter(account => account.currency === settlement.currency && !account.deletedAt);
  const [amount, setAmount] = useState(String(settlement.remainingAmount.toFixed(2)));
  const [paidAt, setPaidAt] = useState(todayDate);
  const [accountId, setAccountId] = useState(
    settlement.accountId && paymentAccounts.some(account => account.id === settlement.accountId) ? settlement.accountId : paymentAccounts[0]?.id ?? ''
  );
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const amountValue = Number(amount);
  const canSubmit = Number.isFinite(amountValue) && amountValue >= 0.01 && !!accountId;

  const submit = () => {
    startTransition(async () => {
      const result = await addSettlementPaymentAction({
        settlementId: settlement.id,
        accountId,
        amount: amountValue,
        paidAt,
        note,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  return (
    <ModalFrame title="Wpłata rozliczenia" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Card style={{ padding: 14, background: T.bg }}>
          <div style={{ color: T.dark, fontSize: 15, fontWeight: 850 }}>{settlement.counterpartyName}</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>Pozostało <PrivacyAmount amount={settlement.remainingAmount} currency={settlement.currency} /></div>
        </Card>
        <input aria-label="Kwota wpłaty" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={inputStyle} />
        <select aria-label="Konto wpłaty" value={accountId} onChange={event => setAccountId(event.target.value)} style={inputStyle}>
          {paymentAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
        </select>
        <input aria-label="Data wpłaty" type="date" value={paidAt} onChange={event => setPaidAt(event.target.value)} style={inputStyle} />
        <input aria-label="Notatka wpłaty" placeholder="Notatka" value={note} onChange={event => setNote(event.target.value)} style={inputStyle} />
        <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
          <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz wpłatę'}
        </button>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <Card style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 850, fontSize: 16, color: T.dark }}>{title}</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </Card>
    </div>
  );
}

function Segmented<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, background: T.bg, borderRadius: T.radiusSm, padding: 4 }}>
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 6,
            background: value === option.value ? T.card : 'transparent',
            color: value === option.value ? T.accent : T.muted,
            fontWeight: 850,
            boxShadow: value === option.value ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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

const smallButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: T.accentLight,
  color: T.accent,
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 30,
  padding: '0 10px',
  cursor: 'pointer',
  fontSize: 12,
  whiteSpace: 'nowrap',
};
