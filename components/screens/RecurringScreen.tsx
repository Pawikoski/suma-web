'use client';

import { CSSProperties, ReactNode, useMemo } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { AlarmClock, CalendarDays, Repeat2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { T } from '@/lib/tokens';
import { RecurringTransaction } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { daysUntil, monthlyRecurringCost, nextRecurringDate, recurringCategoryLabel, recurringFrequencyLabel, RECURRING_CATEGORY_META } from '@/lib/recurring';
import { fmtPLN } from '@/lib/utils';
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
  const { recurringTransactions } = useActiveMonthData();
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(ALL_CATEGORY));
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
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>Dodaj transakcję w aplikacji mobilnej i włącz powtarzanie, żeby web pokazał harmonogram oraz obciążenie miesięczne.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen recurring-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="recurring-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: `linear-gradient(135deg, ${T.accent}, #7c3aed)`, color: 'white', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', right: -28, top: -36, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, opacity: .72, textTransform: 'uppercase', marginBottom: 8 }}>Miesięczne obciążenie</div>
          <PrivacyAmount amount={monthlyTotal} style={{ display: 'block', fontSize: 34, fontWeight: 850, lineHeight: 1.1 }} />
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

      <div className="recurring-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {recurringWithNext.map(({ item, nextDate }) => (
          <RecurringCard key={item.id} recurring={item} nextDate={nextDate} today={today} />
        ))}
      </div>
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
        <PrivacyAmount amount={signedAmount(recurring)} signed style={{ color: amountColor(recurring), fontSize: 15, fontWeight: 850 }} />
      </div>
    </Card>
  );
}

function RecurringCard({ recurring, nextDate, today }: { recurring: RecurringTransaction; nextDate: string | null; today: Date }) {
  const meta = RECURRING_CATEGORY_META[recurring.recurringCategory];
  const days = nextDate ? daysUntil(nextDate, today) : null;
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
          <PrivacyAmount amount={signedAmount(recurring)} signed style={{ display: 'block', color: amountColor(recurring), fontSize: 16, fontWeight: 850 }} />
          <div style={{ fontSize: 11, color: T.faint }}>{fmtPLN(monthlyRecurringCost(recurring))}/mc</div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, color: days !== null && days <= 3 ? T.expense : T.muted, fontSize: 12, fontWeight: 700 }}>
        <CalendarDays size={14} />
        {nextDate ? `${format(parseISO(nextDate), 'd MMMM yyyy', { locale: pl })}${days === 0 ? ' · dzisiaj' : days === 1 ? ' · jutro' : days !== null ? ` · za ${days} dni` : ''}` : 'Brak kolejnej daty'}
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
