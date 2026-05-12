'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { upsertCategoryBudgetAction, upsertOverallBudgetAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { Category } from '@/lib/data';
import { useAppData } from '@/lib/AppDataContext';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Icon from '@/components/ui/Icon';

export default function BudgetScreen() {
  const { categories, overallBudget } = useAppData();
  const router = useRouter();
  const [overallDraft, setOverallDraft] = useState(String(overallBudget ?? ''));
  const [overallPending, startOverallTransition] = useTransition();

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

  const saveOverall = () => {
    startOverallTransition(async () => {
      const result = await upsertOverallBudgetAction({ amount: Number(overallDraft || 0) });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

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
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={overallDraft}
              onChange={e => setOverallDraft(e.target.value)}
              placeholder="Budżet ogólny"
              style={{ flex: 1, height: 38, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '0 12px', font: 'inherit', outline: 'none', color: T.dark }}
            />
            <button
              onClick={saveOverall}
              disabled={overallPending}
              style={{ height: 38, padding: '0 14px', borderRadius: T.radiusSm, background: T.accent, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: overallPending ? 0.65 : 1 }}
            >
              <Save size={16} color="white" /> Zapisz
            </button>
          </div>
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
        {categories.map(c => {
          const catPct = c.budget ? c.spent / c.budget * 100 : 0;
          const over = catPct > 100;
          return (
            <CategoryBudgetCard key={c.id} category={c} catPct={catPct} over={over} />
          );
        })}
      </div>
    </div>
  );
}

function CategoryBudgetCard({ category: c, catPct, over }: { category: Category; catPct: number; over: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(c.budget ? String(c.budget) : '');
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await upsertCategoryBudgetAction({ categoryId: c.id, amount: Number(draft || 0) });
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
                  <div style={{ fontSize: 11, color: T.faint }}>{c.budget ? `z ${fmtPLN(c.budget)}` : 'bez budżetu'}</div>
                </div>
              </div>
              {c.budget ? (
                <>
                  <Bar pct={catPct} color={over ? T.expense : c.color} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: over ? T.expense : T.muted }}>
                      {over ? `Przekroczono o ${fmtPLN(c.spent - c.budget)}` : `Pozostało ${fmtPLN(c.budget - c.spent)}`}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: over ? T.expense : T.accent }}>{Math.round(catPct)}%</span>
                  </div>
                </>
              ) : (
                <div style={{ height: 8, borderRadius: 999, background: T.bg }} />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Budżet kategorii"
                  style={{ flex: 1, height: 34, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '0 10px', font: 'inherit', fontSize: 13, outline: 'none', color: T.dark }}
                />
                <button
                  onClick={save}
                  disabled={pending}
                  style={{ height: 34, padding: '0 10px', borderRadius: T.radiusSm, background: T.dark, color: 'white', fontWeight: 700, fontSize: 13, opacity: pending ? 0.65 : 1 }}
                >
                  Zapisz
                </button>
              </div>
            </Card>
  );
}
