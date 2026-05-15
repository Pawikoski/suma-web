'use client';
import { CSSProperties, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from '@/app/actions/sync';
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
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
        <button aria-label="Dodaj kategorię" onClick={() => setIsCreateOpen(true)} style={primaryButtonStyle}>
          <Plus size={16} color="white" /> Dodaj kategorię
        </button>
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
                  onClick={() => router.push(`/categories/${c.id}?month=${activeMonth}`)}
                  onEdit={() => setEditingCategory(c)}
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
                        onClick={() => router.push(`/categories/${child.id}?month=${activeMonth}`)}
                        onEdit={() => setEditingCategory(child)}
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
      {isCreateOpen && <CategoryFormModal categories={categories} onClose={() => setIsCreateOpen(false)} />}
      {editingCategory && <CategoryFormModal category={editingCategory} categories={categories} onClose={() => setEditingCategory(null)} />}
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
  onEdit,
}: {
  category: Category;
  amount: number;
  txCount: number;
  budget: number | null;
  childCount?: number;
  child?: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();
  const deleteCategory = () => {
    if (!window.confirm('Usunąć kategorię z listy? Powiązana historia transakcji zostanie zachowana.')) return;
    startDeleteTransition(async () => {
      const result = await deleteCategoryAction(c.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            {txCount} transakcji{childCount > 0 ? `, ${childCount} podkategorii` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <PrivacyAmount amount={amount} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: budget && amount > budget ? T.expense : T.dark }} />
          {budget && <div style={{ fontSize: 11, color: T.faint }}>z {fmtPLN(budget)}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={event => event.stopPropagation()}>
          <button aria-label={`Edytuj kategorię ${c.name}`} onClick={onEdit} disabled={c.isSystem} style={{ ...iconButtonStyle, opacity: c.isSystem ? 0.4 : 1 }}>
            <Pencil size={14} />
          </button>
          <button aria-label={`Usuń kategorię ${c.name}`} onClick={deleteCategory} disabled={c.isSystem || isDeleting} style={{ ...iconButtonStyle, color: T.expense, background: T.expenseSoft, opacity: c.isSystem || isDeleting ? 0.4 : 1 }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryFormModal({ category, categories, onClose }: { category?: Category; categories: Category[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? '');
  const [expense, setExpense] = useState(category ? category.types.includes('EXPENSE') : true);
  const [income, setIncome] = useState(category ? category.types.includes('INCOME') : false);
  const [iconName, setIconName] = useState(category?.icon ?? 'category');
  const [iconBg, setIconBg] = useState(category?.bg ?? '#F3F4F6');
  const [iconColor, setIconColor] = useState(category?.color ?? '#6B7280');
  const [parentCategoryId, setParentCategoryId] = useState(category?.parentCategoryId ?? '');
  const [isPending, startTransition] = useTransition();
  const selectedTypes = [expense ? 'EXPENSE' : null, income ? 'INCOME' : null].filter(Boolean) as Array<'EXPENSE' | 'INCOME'>;
  const rootCategories = categories.filter(item => !item.parentCategoryId && item.id !== category?.id && !item.isSystem);
  const canSubmit = name.trim().length > 0 && selectedTypes.length > 0;

  const submit = () => {
    startTransition(async () => {
      const payload = {
        id: category?.id,
        name,
        types: selectedTypes,
        iconName,
        iconBg,
        iconColor,
        parentCategoryId: parentCategoryId || null,
      };
      const result = category ? await updateCategoryAction(payload) : await createCategoryAction(payload);
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
    <div role="dialog" aria-modal="true" aria-label={category ? 'Edycja kategorii' : 'Nowa kategoria'} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <Card style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 850, fontSize: 16, color: T.dark }}>{category ? 'Edycja kategorii' : 'Nowa kategoria'}</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <input aria-label="Nazwa kategorii" placeholder="Nazwa" value={name} onChange={event => setName(event.target.value)} style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={checkStyle}>
              <input type="checkbox" checked={expense} onChange={event => setExpense(event.target.checked)} />
              Wydatek
            </label>
            <label style={checkStyle}>
              <input type="checkbox" checked={income} onChange={event => setIncome(event.target.checked)} />
              Przychód
            </label>
          </div>
          <select aria-label="Kategoria nadrzędna" value={parentCategoryId} onChange={event => setParentCategoryId(event.target.value)} style={inputStyle}>
            <option value="">Bez rodzica</option>
            {rootCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px 52px', gap: 10 }}>
            <input aria-label="Ikona kategorii" placeholder="Ikona" value={iconName} onChange={event => setIconName(event.target.value)} style={inputStyle} />
            <input aria-label="Tło ikony" type="color" value={iconBg} onChange={event => setIconBg(event.target.value)} style={colorInputStyle} />
            <input aria-label="Kolor ikony" type="color" value={iconColor} onChange={event => setIconColor(event.target.value)} style={colorInputStyle} />
          </div>
          <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
            <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz kategorię'}
          </button>
        </div>
      </Card>
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
  minWidth: 0,
};

const colorInputStyle: CSSProperties = {
  ...inputStyle,
  padding: 4,
  cursor: 'pointer',
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
  whiteSpace: 'nowrap',
};

const iconButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  borderRadius: 8,
  background: T.accentLight,
  color: T.accent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const checkStyle: CSSProperties = {
  height: 40,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 12px',
  color: T.mid,
  fontSize: 13,
  fontWeight: 750,
};
