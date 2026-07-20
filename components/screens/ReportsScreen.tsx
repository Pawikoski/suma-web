'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parse } from 'date-fns';
import { pl } from 'date-fns/locale';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { formatMoney } from '@/lib/utils';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  return format(parse(key, 'yyyy-MM', new Date()), 'LLL', { locale: pl });
}

function moneyTick(value: number) {
  return `${Math.round(value / 1000)}k`;
}

function moneyTooltip(value: unknown, currency: string) {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return formatMoney(amount, currency);
}

export default function ReportsScreen() {
  const { activeMonth, allTransactions, categories, baseCurrency } = useActiveMonthData();
  const visibleTransactions = activeMonth === 'all'
    ? allTransactions
    : allTransactions.filter(tx => tx.date.startsWith(activeMonth));
  const income = visibleTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = Math.abs(visibleTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0));
  const net = income - expense;

  const months = Array.from(new Set(allTransactions.map(tx => monthKey(tx.date)))).sort().slice(-6);
  const trendData = months.map(month => {
    const monthTransactions = allTransactions.filter(tx => tx.date.startsWith(month));
    const monthIncome = monthTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const monthExpense = Math.abs(monthTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0));
    return {
      month,
      label: monthLabel(month),
      income: monthIncome,
      expense: monthExpense,
      net: monthIncome - monthExpense,
    };
  });
  const categoryData = categories
    .filter(category => category.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8)
    .map(category => ({
      name: category.name,
      value: category.spent,
      color: category.color,
    }));
  const balanceData = trendData.map((point, index) => ({
    ...point,
    cumulative: trendData.slice(0, index + 1).reduce((sum, item) => sum + item.net, 0),
  }));

  return (
    <div className="screen reports-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="reports-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <ReportMetric label="Przychody" value={income} currency={baseCurrency} color={T.income} />
        <ReportMetric label="Wydatki" value={expense} currency={baseCurrency} color={T.expense} />
        <ReportMetric label="Bilans" value={net} currency={baseCurrency} color={net >= 0 ? T.income : T.expense} signed />
        <ReportMetric label="Transakcje" value={visibleTransactions.length} currency={baseCurrency} color={T.accent} numeric />
      </div>

      <div className="reports-chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card style={{ padding: 20, minHeight: 360 }}>
          <div style={{ color: T.dark, fontSize: 17, fontWeight: 850, marginBottom: 16 }}>Trend miesięczny</div>
          {trendData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={trendData}>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={moneyTick} tick={{ fill: T.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={value => moneyTooltip(value, baseCurrency)} />
                <Bar dataKey="income" name="Przychody" fill={T.income} radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Wydatki" fill={T.expense} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card style={{ padding: 20, minHeight: 360 }}>
          <div style={{ color: T.dark, fontSize: 17, fontWeight: 850, marginBottom: 16 }}>Kategorie wydatków</div>
          {categoryData.length === 0 ? (
            <EmptyChart />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2}>
                    {categoryData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip formatter={value => moneyTooltip(value, baseCurrency)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {categoryData.slice(0, 5).map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                    <span style={{ color: T.muted, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <PrivacyAmount amount={item.value} currency={baseCurrency} style={{ color: T.mid, fontSize: 12, fontWeight: 800 }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card style={{ padding: 20, minHeight: 300 }}>
        <div style={{ color: T.dark, fontSize: 17, fontWeight: 850, marginBottom: 16 }}>Skumulowany bilans</div>
        {balanceData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={balanceData}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: T.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={value => moneyTooltip(value, baseCurrency)} />
              <Line type="monotone" dataKey="cumulative" name="Bilans" stroke={T.accent} strokeWidth={3} dot={{ r: 4, fill: T.accent }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function ReportMetric({ label, value, currency, color, signed = false, numeric = false }: { label: string; value: number; currency: string; color: string; signed?: boolean; numeric?: boolean }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ color: T.muted, fontSize: 12, fontWeight: 750, marginBottom: 8 }}>{label}</div>
      {numeric ? (
        <div style={{ color, fontSize: 28, fontWeight: 850 }}>{value}</div>
      ) : (
        <PrivacyAmount amount={value} currency={currency} signed={signed} style={{ display: 'block', color, fontSize: 24, fontWeight: 850 }} />
      )}
    </Card>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 220, display: 'grid', placeItems: 'center', color: T.faint, fontSize: 14, background: T.bg, borderRadius: T.radiusSm }}>
      Brak danych do wykresu
    </div>
  );
}
