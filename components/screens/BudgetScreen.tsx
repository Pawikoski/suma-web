'use client';
import { Plus } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { useAppData } from '@/lib/AppDataContext';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Icon from '@/components/ui/Icon';

export default function BudgetScreen() {
  const { categories, overallBudget } = useAppData();

  const spent = categories.reduce((s, c) => s + c.spent, 0);
  const totalBudget = overallBudget ?? 0;
  const pct = totalBudget > 0 ? (spent / totalBudget * 100) : 0;

  const now = new Date();
  const monthLabel = now.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const statusGroups = [
    { label: 'OK',            count: categories.filter(c => c.budget && c.spent / c.budget! <= 0.8).length,                              color: T.income },
    { label: 'Blisko limitu', count: categories.filter(c => c.budget && c.spent / c.budget! > 0.8 && c.spent / c.budget! <= 1).length,   color: T.warn },
    { label: 'Przekroczone',  count: categories.filter(c => c.budget && c.spent / c.budget! > 1).length,                                 color: T.expense },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 20, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, marginBottom: 8 }}>
            Budżet ogólny — {monthLabel}
          </div>
          {totalBudget > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 32, fontWeight: 800, color: T.dark, letterSpacing: '-1px' }}>{fmtPLN(spent)}</span>
                  <span style={{ fontSize: 15, color: T.muted, fontWeight: 400 }}> / {fmtPLN(totalBudget)}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 700, color: pct > 100 ? T.expense : T.accent }}>{Math.round(pct)}%</span>
              </div>
              <Bar pct={pct} color={pct > 100 ? T.expense : T.accent} height={10} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: T.muted }}>
                  Pozostało: <strong style={{ color: T.income }}>{fmtPLN(Math.max(totalBudget - spent, 0))}</strong>
                </span>
                <span style={{ fontSize: 12, color: T.muted }}>{daysLeft} dni do końca miesiąca</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: T.faint, marginTop: 8 }}>Brak ustawionego budżetu ogólnego</div>
          )}
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, marginBottom: 12 }}>Kategorie w budżecie</div>
          {statusGroups.map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 13, color: T.mid }}>{s.label}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.count}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {categories.filter(c => c.budget).map(c => {
          const catPct = c.spent / c.budget! * 100;
          const over = catPct > 100;
          return (
            <Card key={c.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={c.icon} size={20} color={c.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{c.txCount} transakcji</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: over ? T.expense : T.dark }}>{fmtPLN(c.spent)}</div>
                  <div style={{ fontSize: 11, color: T.faint }}>z {fmtPLN(c.budget!)}</div>
                </div>
              </div>
              <Bar pct={catPct} color={over ? T.expense : c.color} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: over ? T.expense : T.muted }}>
                  {over ? `Przekroczono o ${fmtPLN(c.spent - c.budget!)}` : `Pozostało ${fmtPLN(c.budget! - c.spent)}`}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: over ? T.expense : T.accent }}>{Math.round(catPct)}%</span>
              </div>
            </Card>
          );
        })}

        <Card style={{ padding: 16, border: `2px dashed ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 80 }}>
          <div style={{ textAlign: 'center', color: T.faint }}>
            <Plus size={20} color={T.faint} />
            <div style={{ fontSize: 12, marginTop: 4 }}>Dodaj kategorię</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
