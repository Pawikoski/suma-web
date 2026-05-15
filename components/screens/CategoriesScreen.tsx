'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { Category } from '@/lib/data';
import { groupCategoriesForView } from '@/lib/category-hierarchy';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Donut from '@/components/ui/Donut';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const VIEWS = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'expense', label: 'Wydatki' },
  { id: 'income', label: 'Przychody' },
] as const;

export default function CategoriesScreen() {
  const router = useRouter();
  const [view, setView] = useState<string>('all');
  const { categories, activeMonth } = useActiveMonthData();
  const visibleCategories = categories.filter(c => {
    if (view === 'all') return true;
    return c.types.includes(view.toUpperCase());
  });
  const categoryGroups = groupCategoriesForView(categories, view);
  const totalSpent = visibleCategories.reduce((s, c) => s + c.spent, 0);
  const topCategories = [...visibleCategories].sort((a, b) => b.spent - a.spent);

  const now = new Date(`${activeMonth}-15T12:00:00`);
  const monthLabel = now.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <div className="screen categories-screen" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: view === v.id ? T.dark : 'transparent',
              color: view === v.id ? 'white' : T.muted,
              border: `1px solid ${view === v.id ? T.dark : T.border}`,
              transition: 'all .15s', cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="categories-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categoryGroups.length === 0 && (
            <div style={{ textAlign: 'center', fontSize: 13, color: T.faint, padding: 32 }}>Brak kategorii</div>
          )}
          {categoryGroups.map(group => {
            const c = group.category;
            const pct = group.totalBudget ? (group.totalSpent / group.totalBudget * 100) : null;
            const over = pct !== null && pct > 100;
            return (
              <Card key={c.id} style={{ padding: 0, overflow: 'hidden' }}>
                <CategoryRow
                  category={c}
                  amount={group.totalSpent}
                  txCount={group.totalTxCount}
                  budget={group.totalBudget}
                  childCount={group.children.length}
                  onClick={() => router.push(`/transactions?category=${c.id}&month=${activeMonth}`)}
                />
                {group.totalBudget && pct !== null && (
                  <div style={{ padding: '0 16px 12px' }}>
                    <Bar pct={pct} color={over ? T.expense : c.color} />
                    {over && <div style={{ fontSize: 11, color: T.expense, marginTop: 4, fontWeight: 500 }}>Przekroczono budżet o {fmtPLN(group.totalSpent - group.totalBudget)}</div>}
                  </div>
                )}
                {group.children.length > 0 && (
                  <div style={{ borderTop: `1px solid ${T.border}` }}>
                    {group.children.map(child => (
                      <CategoryRow
                        key={child.id}
                        category={child}
                        amount={child.spent}
                        txCount={child.txCount}
                        budget={child.budget}
                        child
                        onClick={() => router.push(`/transactions?category=${child.id}&month=${activeMonth}`)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.dark, marginBottom: 16 }}>Łącznie wydane</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {totalSpent > 0 ? (
                <Donut data={topCategories.map(c => ({ value: c.spent, color: c.color }))} size={130} />
              ) : (
                <div style={{ width: 130, height: 130, borderRadius: '50%', background: T.bg }} />
              )}
              <div style={{ flex: 1 }}>
                <PrivacyAmount amount={totalSpent} style={{ display: 'block', fontSize: 28, fontWeight: 800, color: T.dark, marginBottom: 4 }} />
                <div style={{ fontSize: 12, color: T.muted }}>{monthLabel}</div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCategories.slice(0, 4).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.mid }}>
                        {totalSpent > 0 ? Math.round(c.spent / totalSpent * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {visibleCategories.some(c => c.budget) && (
            <Card style={{ padding: 16, background: T.accentLight }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.accent, marginBottom: 8 }}>Podsumowanie budżetów</div>
              {topCategories.filter(c => c.budget).map(c => {
                const pct = c.spent / c.budget! * 100;
                return (
                  <div key={c.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.mid }}>
                        <Icon name={c.icon} size={13} color={c.color} />{c.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pct > 100 ? T.expense : T.mid }}>{Math.round(pct)}%</span>
                    </div>
                    <Bar pct={pct} color={pct > 100 ? T.expense : T.accent} height={4} />
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category: c,
  amount,
  txCount,
  budget,
  childCount = 0,
  child = false,
  onClick,
}: {
  category: Category;
  amount: number;
  txCount: number;
  budget: number | null;
  childCount?: number;
  child?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ padding: child ? '12px 16px 12px 34px' : 16, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={c.icon} size={20} color={c.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>{c.name}</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            {txCount} transakcji{childCount > 0 ? `, ${childCount} podkategorii` : ''}
          </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
          <PrivacyAmount amount={amount} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: budget && amount > budget ? T.expense : T.dark }} />
          {budget && <div style={{ fontSize: 11, color: T.faint }}>z {fmtPLN(budget)}</div>}
                  </div>
                </div>
    </div>
  );
}
