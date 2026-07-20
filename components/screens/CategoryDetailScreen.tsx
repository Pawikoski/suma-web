'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ListFilter, Pencil } from 'lucide-react';
import { T } from '@/lib/tokens';
import { Category, Transaction } from '@/lib/data';
import { formatMoney, formatMoneyShort } from '@/lib/utils';
import { categoryAndDescendantIds, effectiveCategoryBudget } from '@/lib/category-hierarchy';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

function categoryAmount(transaction: Transaction, categoryIds: Set<string>) {
  return transaction.splits
    .filter(split => split.categoryId && categoryIds.has(split.categoryId))
    .reduce((sum, split) => sum + split.amount, 0);
}

function categoryTypeLabel(category: Category) {
  const labels = [];
  if (category.types.includes('EXPENSE')) labels.push('wydatki');
  if (category.types.includes('INCOME')) labels.push('przychody');
  return labels.join(' i ') || 'kategoria';
}

export default function CategoryDetailScreen({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const { categories, allTransactions, activeMonth, baseCurrency } = useActiveMonthData();
  const category = categories.find(item => item.id === categoryId) ?? null;

  if (!category) {
    return (
      <div className="screen category-detail-screen" style={{ padding: 24 }}>
        <Card style={{ padding: 24, textAlign: 'center', color: T.muted }}>Nie znaleziono kategorii.</Card>
      </div>
    );
  }

  const parent = category.parentCategoryId ? categories.find(item => item.id === category.parentCategoryId) ?? null : null;
  const children = categories
    .filter(item => item.parentCategoryId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl'));
  const categoryIds = categoryAndDescendantIds(categories, category.id);
  const monthTransactions = allTransactions.filter(transaction => activeMonth === 'all' || transaction.date.startsWith(activeMonth));
  const relatedTransactions = monthTransactions
    .map(transaction => ({ transaction, amount: categoryAmount(transaction, categoryIds) }))
    .filter(item => item.amount > 0);
  const income = relatedTransactions
    .filter(item => item.transaction.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = relatedTransactions
    .filter(item => item.transaction.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const recent = relatedTransactions
    .sort((a, b) => b.transaction.dateTime.localeCompare(a.transaction.dateTime))
    .slice(0, 6);
  const budget = effectiveCategoryBudget(categories, category.id);
  const effectiveBudget = budget > 0 ? budget : null;
  const budgetPct = effectiveBudget ? expense / effectiveBudget * 100 : 0;

  return (
    <div className="screen category-detail-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.push(`/categories?month=${activeMonth}`)}
          style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.bg, color: T.mid, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <ArrowLeft size={16} /> Kategorie
        </button>
        <Link
          href={`/transactions?category=${category.id}&month=${activeMonth}`}
          style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.dark, color: 'white', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <ListFilter size={16} color="white" /> Zobacz transakcje
        </Link>
      </div>

      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 74, height: 74, borderRadius: 22, background: category.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={category.icon} size={34} color={category.color} />
          </div>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 950, color: T.dark }}>{category.name}</h1>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
              {parent ? `${parent.name} / ` : ''}{categoryTypeLabel(category)} · {relatedTransactions.length} transakcji
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {category.types.includes('INCOME') && (
              <AmountPill label="Przychody" amount={income} currency={baseCurrency} color={T.income} bg={T.incomeSoft} />
            )}
            {category.types.includes('EXPENSE') && (
              <AmountPill label="Wydatki" amount={expense} currency={baseCurrency} color={T.expense} bg={T.expenseSoft} prefix="- " />
            )}
          </div>
        </div>
      </Card>

      <div className="category-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {effectiveBudget && (
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 850, color: T.dark }}>Budżet kategorii</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{activeMonth === 'all' ? 'Wszystkie miesiące' : activeMonth}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <PrivacyAmount amount={expense} currency={baseCurrency} style={{ display: 'block', fontSize: 18, fontWeight: 900, color: budgetPct > 100 ? T.expense : T.dark }} />
                  <div style={{ fontSize: 11, color: T.faint }}>z {formatMoneyShort(effectiveBudget, baseCurrency)}</div>
                </div>
              </div>
              <Bar pct={budgetPct} color={budgetPct > 100 ? T.expense : category.color} height={8} />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted }}>
                <span>{budgetPct > 100 ? `Przekroczono o ${formatMoney(expense - effectiveBudget, baseCurrency)}` : `Pozostało ${formatMoney(effectiveBudget - expense, baseCurrency)}`}</span>
                <strong style={{ color: budgetPct > 100 ? T.expense : T.accent }}>{Math.round(budgetPct)}%</strong>
              </div>
            </Card>
          )}

          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 850, color: T.dark, marginBottom: 12 }}>Podkategorie</div>
            {children.length === 0 ? (
              <div style={{ fontSize: 13, color: T.faint }}>Brak podkategorii</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => router.push(`/categories/${child.id}?month=${activeMonth}`)}
                    style={{ minHeight: 50, borderRadius: T.radiusSm, background: T.bg, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                  >
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: child.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={child.icon} size={16} color={child.color} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', color: T.dark, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
                      <span style={{ display: 'block', color: T.muted, fontSize: 11 }}>{child.txCount} transakcji</span>
                    </span>
	                    <PrivacyAmount amount={child.spent} currency={baseCurrency} style={{ color: child.spent > (child.budget ?? Infinity) ? T.expense : T.mid, fontSize: 13, fontWeight: 850 }} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 850, color: T.dark }}>Ostatnie transakcje</div>
            <Link href={`/transactions?category=${category.id}&month=${activeMonth}`} style={{ color: T.accent, fontSize: 12, fontWeight: 850, textDecoration: 'none' }}>
              Wszystkie
            </Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ minHeight: 160, display: 'grid', placeItems: 'center', color: T.faint, fontSize: 13 }}>
              Brak transakcji w tym okresie
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map(({ transaction, amount }) => (
                <button
                  key={transaction.id}
                  onClick={() => router.push(`/transactions?id=${transaction.id}&month=${transaction.date.slice(0, 7)}`)}
                  style={{ minHeight: 58, borderRadius: T.radiusSm, background: T.bg, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: transaction.catBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={transaction.catIcon} size={17} color={transaction.catColor} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', color: T.dark, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transaction.desc || transaction.cat}</span>
                    <span style={{ display: 'block', color: T.muted, fontSize: 11 }}>{transaction.date} · {transaction.acc}</span>
                  </span>
	                  <PrivacyAmount amount={amount} currency={transaction.currency} prefix={transaction.type === 'expense' ? '- ' : '+ '} style={{ color: transaction.type === 'expense' ? T.expense : T.income, fontSize: 13, fontWeight: 900 }} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {!category.isSystem && (
        <Link href={`/categories?month=${activeMonth}`} style={{ alignSelf: 'center', color: T.muted, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <Pencil size={14} /> Edytuj kategorię na liście kategorii
        </Link>
      )}
    </div>
  );
}

function AmountPill({ label, amount, currency, color, bg, prefix = '' }: { label: string; amount: number; currency: string; color: string; bg: string; prefix?: string }) {
  return (
    <div style={{ minWidth: 142, borderRadius: 999, background: bg, color, padding: '8px 14px', textAlign: 'center' }}>
      <PrivacyAmount amount={amount} currency={currency} prefix={prefix} style={{ display: 'block', fontSize: 15, fontWeight: 950 }} />
      <span style={{ display: 'block', fontSize: 11, fontWeight: 800 }}>{label}</span>
    </div>
  );
}
