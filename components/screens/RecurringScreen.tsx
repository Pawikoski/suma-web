'use client';

import { CSSProperties, ReactNode, useMemo, useState, useTransition } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { useRouter } from 'next/navigation';
import { AlarmClock, CalendarDays, Plus, Repeat2, Save, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import { createRecurringTransactionAction, deleteRecurringTransactionAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Account, Category, RecurringCategory, RecurringFrequency, RecurringTransaction } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { daysUntil, monthlyRecurringCost, nextRecurringDate, recurringCategoryLabel, recurringFrequencyLabel, RECURRING_CATEGORY_META } from '@/lib/recurring';
import { formatMoneyShort } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const ALL_CATEGORY = 'all';

function amountColor(recurring: RecurringTransaction) {
  if (recurring.type === 'income') return T.income;
  if (recurring.type === 'expense') return T.expense;
  return T.accent;
}

function signedAmount(recurring: RecurringTransaction) {
  const amount = recurring.amount ?? 0;
  if (recurring.type === 'expense') return -amount;
  return amount;
}

function accountLabel(recurring: RecurringTransaction) {
  if (recurring.fromAccountName && recurring.toAccountName) return `${recurring.fromAccountName} -> ${recurring.toAccountName}`;
  return recurring.fromAccountName ?? recurring.toAccountName ?? 'Brak konta';
}

export default function RecurringScreen() {
  const { recurringTransactions, accounts, categories, baseCurrency } = useActiveMonthData();
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(ALL_CATEGORY));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const activeRecurring = recurringTransactions.filter(item => item.isActive);
  const categoryKeys = Array.from(new Set(activeRecurring.map(item => item.recurringCategory)));
  const filtered = category === ALL_CATEGORY
    ? activeRecurring
    : activeRecurring.filter(item => item.recurringCategory === category);
  const recurringWithNext = filtered
    .map(item => ({ item, nextDate: nextRecurringDate(item, today) }))
    .sort((a, b) => (a.nextDate ?? '9999-12-31').localeCompare(b.nextDate ?? '9999-12-31'));
  const upcoming = recurringWithNext.filter(entry => entry.nextDate && daysUntil(entry.nextDate, today) <= 14);
  const monthlyTotal = activeRecurring
    .filter(item => item.type === 'expense')
    .reduce((sum, item) => sum + monthlyRecurringCost(item), 0);
  const paidThisMonth = activeRecurring.filter(item => {
    if (!item.lastGeneratedDate) return false;
    return item.lastGeneratedDate.startsWith(format(today, 'yyyy-MM'));
  }).length;

  if (activeRecurring.length === 0) {
    return (
      <div className="screen recurring-screen" style={{ minHeight: '100%', padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: T.accentLight, display: 'grid', placeItems: 'center' }}>
            <Repeat2 size={34} color={T.accent} />
          </div>
          <h1 style={{ fontSize: 24, color: T.dark, marginBottom: 8 }}>Brak opłat stałych</h1>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 18 }}>Dodaj transakcję w aplikacji mobilnej i włącz powtarzanie, żeby web pokazał harmonogram oraz obciążenie miesięczne.</p>
          <button onClick={() => setIsCreateOpen(true)} style={primaryButtonStyle}>
            <Plus size={16} color="white" /> Dodaj opłatę stałą
          </button>
        </div>
        {isCreateOpen && <RecurringFormModal accounts={accounts} categories={categories} onClose={() => setIsCreateOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="screen recurring-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="recurring-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: `linear-gradient(135deg, ${T.accent}, #7c3aed)`, color: 'white', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', right: -28, top: -36, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, opacity: .72, textTransform: 'uppercase', marginBottom: 8 }}>Miesięczne obciążenie</div>
          <PrivacyAmount amount={monthlyTotal} currency={baseCurrency} style={{ display: 'block', fontSize: 34, fontWeight: 850, lineHeight: 1.1 }} />
          <div style={{ display: 'flex', gap: 28, marginTop: 22 }}>
            <SummaryStat value={activeRecurring.length} label="Opłaty stałe" />
            <SummaryStat value={paidThisMonth} label="Opłacone w miesiącu" />
          </div>
        </Card>
        <MetricCard icon={<AlarmClock size={20} color={T.warn} />} label="Najbliższe 14 dni" value={upcoming.length} />
        <MetricCard icon={<CalendarDays size={20} color={T.accent} />} label="Aktywne szablony" value={filtered.length} />
      </div>

      {upcoming.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, color: T.dark, fontWeight: 800 }}>Nadchodzące</h2>
            <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>14 dni</span>
          </div>
          <div className="recurring-upcoming-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12 }}>
            {upcoming.slice(0, 4).map(({ item, nextDate }) => (
              <UpcomingCard key={`${item.id}-${nextDate}`} recurring={item} nextDate={nextDate!} today={today} />
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            onClick={() => void setCategory(ALL_CATEGORY)}
            style={chipStyle(category === ALL_CATEGORY)}
          >
            Wszystkie
          </button>
          {categoryKeys.map(key => {
            const meta = RECURRING_CATEGORY_META[key];
            return (
              <button key={key} onClick={() => void setCategory(key)} style={chipStyle(category === key)}>
                <Icon name={meta.icon} size={16} color={category === key ? 'white' : meta.color} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <button aria-label="Dodaj opłatę stałą" onClick={() => setIsCreateOpen(true)} style={{ ...primaryButtonStyle, height: 36, padding: '0 14px', flexShrink: 0 }}>
          <Plus size={16} color="white" /> Dodaj
        </button>
      </div>

      <div className="recurring-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {recurringWithNext.map(({ item, nextDate }) => (
          <RecurringCard key={item.id} recurring={item} nextDate={nextDate} today={today} />
        ))}
      </div>
      {isCreateOpen && <RecurringFormModal accounts={accounts} categories={categories} onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}

function RecurringFormModal({ accounts, categories, onClose }: { accounts: Account[]; categories: Category[]; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [intervalValue, setIntervalValue] = useState('1');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [recurringCategory, setRecurringCategory] = useState<RecurringCategory>('BILL');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const targetType = type === 'income' ? 'INCOME' : 'EXPENSE';
  const eligibleCategories = categories.filter(item => item.types.length === 0 || item.types.includes(targetType));
  const effectiveCategoryId = categoryId || eligibleCategories[0]?.id || '';
  const amountValue = Number(amount);
  const canSubmit = amountValue > 0 && !!accountId && !!effectiveCategoryId && Number(intervalValue) > 0;

  const submit = () => {
    startTransition(async () => {
      const result = await createRecurringTransactionAction({
        type,
        amount: amountValue,
        accountId,
        categoryId: effectiveCategoryId,
        frequency,
        intervalValue: Number(intervalValue),
        startDate,
        endDate: endDate || null,
        notes,
        recurringCategory,
        recurringCategoryLabel: label,
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
    <div role="dialog" aria-modal="true" aria-label="Nowa opłata stała" style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <Card style={{ width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 850, fontSize: 16, color: T.dark }}>Nowa opłata stała</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, background: T.bg, borderRadius: T.radiusSm, padding: 4 }}>
            {(['expense', 'income'] as const).map(item => (
              <button
                key={item}
                onClick={() => { setType(item); setCategoryId(''); }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 6, background: type === item ? T.card : 'transparent', color: type === item ? T.accent : T.muted, fontWeight: 850, boxShadow: type === item ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}
              >
                {item === 'expense' ? 'Wydatek' : 'Przychód'}
              </button>
            ))}
          </div>
          <input aria-label="Kwota opłaty stałej" placeholder="Kwota" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={inputStyle} />
          <select aria-label="Konto opłaty stałej" value={accountId} onChange={event => setAccountId(event.target.value)} style={inputStyle}>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
          </select>
          <select aria-label="Kategoria opłaty stałej" value={effectiveCategoryId} onChange={event => setCategoryId(event.target.value)} style={inputStyle}>
            {eligibleCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
            <select aria-label="Częstotliwość opłaty stałej" value={frequency} onChange={event => setFrequency(event.target.value as RecurringFrequency)} style={inputStyle}>
              <option value="DAILY">Codziennie</option>
              <option value="WEEKLY">Co tydzień</option>
              <option value="MONTHLY">Co miesiąc</option>
              <option value="YEARLY">Co rok</option>
            </select>
            <input aria-label="Interwał opłaty stałej" type="number" min="1" max="99" value={intervalValue} onChange={event => setIntervalValue(event.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input aria-label="Start opłaty stałej" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} style={inputStyle} />
            <input aria-label="Koniec opłaty stałej" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} style={inputStyle} />
          </div>
          <select aria-label="Typ opłaty stałej" value={recurringCategory} onChange={event => setRecurringCategory(event.target.value as RecurringCategory)} style={inputStyle}>
            {(Object.keys(RECURRING_CATEGORY_META) as RecurringCategory[]).map(key => <option key={key} value={key}>{RECURRING_CATEGORY_META[key].label}</option>)}
          </select>
          <input aria-label="Nazwa opłaty stałej" placeholder="Nazwa" value={label} onChange={event => setLabel(event.target.value)} style={inputStyle} />
          <input aria-label="Notatka opłaty stałej" placeholder="Notatka" value={notes} onChange={event => setNotes(event.target.value)} style={inputStyle} />
          <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
            <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz opłatę stałą'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 850 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: .68 }}>{label}</div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 132 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, color: T.dark, fontWeight: 850 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{label}</div>
      </div>
    </Card>
  );
}

function UpcomingCard({ recurring, nextDate, today }: { recurring: RecurringTransaction; nextDate: string; today: Date }) {
  const meta = RECURRING_CATEGORY_META[recurring.recurringCategory];
  const days = daysUntil(nextDate, today);
  const urgent = days <= 3;
  return (
    <Card style={{ padding: 14, borderColor: urgent ? '#fecaca' : T.border, background: urgent ? '#fff7ed' : T.card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: meta.bg, display: 'grid', placeItems: 'center' }}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </div>
        <span style={{ padding: '4px 8px', borderRadius: 8, background: urgent ? '#fee2e2' : T.bg, color: urgent ? T.expense : T.muted, fontSize: 11, fontWeight: 800 }}>
          {days === 0 ? 'dzisiaj' : days === 1 ? 'jutro' : `za ${days} dni`}
        </span>
      </div>
      <div style={{ fontSize: 13, color: T.dark, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recurringCategoryLabel(recurring)}</div>
      <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 18 }}>{recurring.notes || accountLabel(recurring)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: T.faint }}>{format(parseISO(nextDate), 'd MMM', { locale: pl })}</span>
        <PrivacyAmount amount={signedAmount(recurring)} currency={recurring.currency} signed style={{ color: amountColor(recurring), fontSize: 15, fontWeight: 850 }} />
      </div>
    </Card>
  );
}

function RecurringCard({ recurring, nextDate, today }: { recurring: RecurringTransaction; nextDate: string | null; today: Date }) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();
  const meta = RECURRING_CATEGORY_META[recurring.recurringCategory];
  const days = nextDate ? daysUntil(nextDate, today) : null;
  const deleteRecurring = () => {
    if (!window.confirm('Usunąć opłatę stałą?')) return;

    startDeleteTransition(async () => {
      const result = await deleteRecurringTransactionAction(recurring.id);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: meta.bg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={meta.icon} size={24} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, color: T.dark, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recurringCategoryLabel(recurring)}</div>
          <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recurring.notes || accountLabel(recurring)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: 5, color: T.faint, fontSize: 12 }}>
            <span>{recurringFrequencyLabel(recurring)}</span>
            <span>{accountLabel(recurring)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <PrivacyAmount amount={signedAmount(recurring)} currency={recurring.currency} signed style={{ display: 'block', color: amountColor(recurring), fontSize: 16, fontWeight: 850 }} />
          <div style={{ fontSize: 11, color: T.faint }}>{formatMoneyShort(monthlyRecurringCost(recurring), recurring.currency)}/mc</div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: days !== null && days <= 3 ? T.expense : T.muted, fontSize: 12, fontWeight: 700 }}>
          <CalendarDays size={14} />
          {nextDate ? `${format(parseISO(nextDate), 'd MMMM yyyy', { locale: pl })}${days === 0 ? ' · dzisiaj' : days === 1 ? ' · jutro' : days !== null ? ` · za ${days} dni` : ''}` : 'Brak kolejnej daty'}
        </div>
        <button aria-label={`Usuń opłatę stałą ${recurringCategoryLabel(recurring)}`} onClick={deleteRecurring} disabled={isDeleting} style={{ ...smallIconButtonStyle, opacity: isDeleting ? 0.55 : 1 }}>
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}

function chipStyle(active: boolean): CSSProperties {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accent : T.card,
    color: active ? 'white' : T.mid,
    fontSize: 13,
    fontWeight: 750,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
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

const smallIconButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  borderRadius: 8,
  background: T.expenseSoft,
  color: T.expense,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};
