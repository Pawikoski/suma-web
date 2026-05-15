'use client';
import { useState } from 'react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { useAppData } from '@/lib/AppDataContext';
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
  const [view, setView] = useState<string>('all');
  const { categories } = useAppData();
  const visibleCategories = categories.filter(c => {
    if (view === 'all') return true;
    return c.types.includes(view.toUpperCase());
  });
  const totalSpent = visibleCategories.reduce((s, c) => s + c.spent, 0);

  const now = new Date();
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
          {visibleCategories.length === 0 && (
            <div style={{ textAlign: 'center', fontSize: 13, color: T.faint, padding: 32 }}>Brak kategorii</div>
          )}
          {visibleCategories.map(c => {
            const pct = c.budget ? (c.spent / c.budget * 100) : null;
            const over = pct !== null && pct > 100;
            return (
              <Card key={c.id} style={{ padding: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: c.budget ? 10 : 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={c.icon} size={20} color={c.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{c.txCount} transakcji</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <PrivacyAmount amount={c.spent} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: over ? T.expense : T.dark }} />
                    {c.budget && <div style={{ fontSize: 11, color: T.faint }}>z {fmtPLN(c.budget)}</div>}
                  </div>
                </div>
                {c.budget && pct !== null && (
                  <>
                    <Bar pct={pct} color={over ? T.expense : c.color} />
                    {over && <div style={{ fontSize: 11, color: T.expense, marginTop: 4, fontWeight: 500 }}>Przekroczono budżet o {fmtPLN(c.spent - c.budget!)}</div>}
                  </>
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
                <Donut data={visibleCategories.map(c => ({ value: c.spent, color: c.color }))} size={130} />
              ) : (
                <div style={{ width: 130, height: 130, borderRadius: '50%', background: T.bg }} />
              )}
              <div style={{ flex: 1 }}>
                <PrivacyAmount amount={totalSpent} style={{ display: 'block', fontSize: 28, fontWeight: 800, color: T.dark, marginBottom: 4 }} />
                <div style={{ fontSize: 12, color: T.muted }}>{monthLabel}</div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleCategories.slice(0, 4).map(c => (
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
              {visibleCategories.filter(c => c.budget).map(c => {
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
