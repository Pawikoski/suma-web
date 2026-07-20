'use client';

import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, parse, startOfMonth } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { T } from '@/lib/tokens';
import { Transaction } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

interface DayTotals {
  income: number;
  expense: number;
}

function monthKey(date: Date) {
  return format(date, 'yyyy-MM');
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function buildDailyTotals(transactions: Transaction[]) {
  const totals = new Map<string, DayTotals>();
  for (const transaction of transactions) {
    if (transaction.type === 'transfer') continue;
    const current = totals.get(transaction.date) ?? { income: 0, expense: 0 };
    if (transaction.type === 'income') current.income += transaction.rawAmount;
    if (transaction.type === 'expense') current.expense += transaction.rawAmount;
    totals.set(transaction.date, current);
  }
  return totals;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { allTransactions, activeMonth, yearMonth, baseCurrency } = useActiveMonthData();
  const centerMonth = activeMonth === 'all' ? yearMonth : activeMonth;
  const centerDate = parse(centerMonth, 'yyyy-MM', new Date());
  const months = [addMonths(centerDate, -1), centerDate, addMonths(centerDate, 1)];
  const dailyTotals = buildDailyTotals(allTransactions);

  const openDay = (date: string) => {
    router.push(`/transactions?date=${encodeURIComponent(date)}&month=${date.slice(0, 7)}`);
  };

  return (
    <div className="screen calendar-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {months.map(month => (
        <MonthCalendar key={monthKey(month)} month={month} dailyTotals={dailyTotals} currency={baseCurrency} onDayClick={openDay} />
      ))}
    </div>
  );
}

function MonthCalendar({ month, dailyTotals, currency, onDayClick }: { month: Date; dailyTotals: Map<string, DayTotals>; currency: string; onDayClick: (date: string) => void }) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDayOffset = (getDay(days[0]) + 6) % 7;
  const emptyCells = Array.from({ length: firstDayOffset });
  const monthId = monthKey(month);
  const monthEntries = Array.from(dailyTotals.entries()).filter(([date]) => date.startsWith(monthId));
  const monthIncome = monthEntries.reduce((sum, [, totals]) => sum + totals.income, 0);
  const monthExpense = monthEntries.reduce((sum, [, totals]) => sum + totals.expense, 0);
  const monthNet = monthIncome - monthExpense;
  const monthLabel = format(month, 'LLLL yyyy', { locale: pl });

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ color: T.income, fontSize: 13, fontWeight: 800 }}>
          {monthIncome > 0 ? <PrivacyAmount amount={monthIncome} currency={currency} prefix="+ " /> : null}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: T.dark, fontSize: 18, fontWeight: 900, textTransform: 'capitalize' }}>{monthLabel}</h1>
          {(monthIncome > 0 || monthExpense > 0) && (
            <div style={{ color: monthNet >= 0 ? T.income : T.expense, fontSize: 12, fontWeight: 800 }}>
              <PrivacyAmount amount={Math.abs(monthNet)} currency={currency} prefix={monthNet >= 0 ? '+ ' : '- '} />
            </div>
          )}
        </div>
        <div style={{ color: T.expense, fontSize: 13, fontWeight: 800, textAlign: 'right' }}>
          {monthExpense > 0 ? <PrivacyAmount amount={monthExpense} currency={currency} prefix="- " /> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((label, index) => (
          <div key={label} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: index >= 5 ? T.faint : T.muted }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {emptyCells.map((_, index) => <div key={`empty-${index}`} />)}
        {days.map(day => {
          const date = dayKey(day);
          const totals = dailyTotals.get(date);
          const hasData = Boolean(totals && (totals.income > 0 || totals.expense > 0));
          const net = (totals?.income ?? 0) - (totals?.expense ?? 0);
          const expenseFraction = monthExpense > 0 && totals?.expense ? Math.min(totals.expense / monthExpense, 1) : 0;

          return (
            <button
              key={date}
              type="button"
              disabled={!hasData}
              aria-label={`Dzień ${format(day, 'd MMMM yyyy', { locale: pl })}`}
              onClick={() => onDayClick(date)}
              style={{
                position: 'relative',
                minHeight: 74,
                borderRadius: 10,
                background: hasData ? T.card : 'transparent',
                color: hasData ? T.dark : T.faint,
                border: hasData ? `1px solid ${T.border}` : '1px solid transparent',
                padding: '8px 4px 12px',
                textAlign: 'center',
                opacity: hasData ? 1 : 0.72,
                cursor: hasData ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: hasData ? 900 : 600 }}>{format(day, 'd')}</div>
              {hasData && (
                <div style={{ marginTop: 4, color: net >= 0 ? T.income : T.expense, fontSize: 11, fontWeight: 850, lineHeight: 1.1 }}>
	                  <PrivacyAmount amount={Math.abs(net)} currency={currency} prefix={net >= 0 ? '+ ' : '- '} />
                </div>
              )}
              {expenseFraction > 0 && (
                <div style={{ position: 'absolute', left: 6, right: 6, bottom: 5, height: 3, borderRadius: 999, background: T.bg, overflow: 'hidden' }}>
                  <div style={{ width: `${expenseFraction * 100}%`, height: '100%', borderRadius: 999, background: T.expense }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
