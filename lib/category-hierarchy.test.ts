import { describe, expect, it } from 'vitest';
import { Category } from './data';
import {
  categoryAndDescendantIds,
  categoryBudgetUsages,
  effectiveCategoryBudget,
  groupCategoriesForView,
  nonOverlappingCategoryBudgetSummary,
} from './category-hierarchy';

const category = (overrides: Partial<Category>): Category => ({
  id: 'cat',
  name: 'Category',
  types: ['EXPENSE'],
  icon: 'category',
  bg: '#fff',
  color: '#111',
  spent: 0,
  budget: null,
  budgetId: null,
  budgetVersion: null,
  txCount: 0,
  parentCategoryId: null,
  isSystem: false,
  sortOrder: 1,
  updatedAt: '2026-05-01T00:00:00Z',
  deletedAt: null,
  version: 1,
  ...overrides,
});

describe('groupCategoriesForView', () => {
  it('keeps child categories under their parent and rolls up totals', () => {
    const groups = groupCategoriesForView([
      category({ id: 'food', name: 'Food', spent: 10, txCount: 1 }),
      category({ id: 'groceries', name: 'Groceries', parentCategoryId: 'food', spent: 20, txCount: 2, sortOrder: 2 }),
    ], 'expense');

    expect(groups).toHaveLength(1);
    expect(groups[0].children.map(child => child.id)).toEqual(['groceries']);
    expect(groups[0]).toMatchObject({ totalSpent: 30, totalTxCount: 3 });
  });

  it('still shows a parent container when only a child matches the view', () => {
    const groups = groupCategoriesForView([
      category({ id: 'root', types: ['INCOME'] }),
      category({ id: 'child', parentCategoryId: 'root', types: ['EXPENSE'] }),
    ], 'expense');

    expect(groups.map(group => group.category.id)).toEqual(['root']);
    expect(groups[0].children.map(child => child.id)).toEqual(['child']);
  });

  it('finds descendants for transaction filtering', () => {
    const ids = categoryAndDescendantIds([
      category({ id: 'root' }),
      category({ id: 'child', parentCategoryId: 'root' }),
      category({ id: 'grandchild', parentCategoryId: 'child' }),
      category({ id: 'other' }),
    ], 'root');

    expect(Array.from(ids).sort()).toEqual(['child', 'grandchild', 'root']);
  });

  it('treats parent budget as an envelope and child budget as a sublimit', () => {
    const categories = [
      category({ id: 'food', budget: 1000, spent: 100 }),
      category({ id: 'kebab', parentCategoryId: 'food', budget: 300, spent: 250 }),
    ];

    const groups = groupCategoriesForView(categories, 'expense');
    const usages = categoryBudgetUsages(categories);
    const summary = nonOverlappingCategoryBudgetSummary(categories);

    expect(groups[0]).toMatchObject({ totalBudget: 1000, totalSpent: 350 });
    expect(usages.find(item => item.category.id === 'kebab')?.isSubLimit).toBe(true);
    expect(summary).toEqual({ budget: 1000, spent: 350 });
  });

  it('uses child budgets as group budget when parent has no own budget', () => {
    const categories = [
      category({ id: 'food', budget: null }),
      category({ id: 'kebab', parentCategoryId: 'food', budget: 300 }),
      category({ id: 'groceries', parentCategoryId: 'food', budget: 500 }),
    ];

    expect(effectiveCategoryBudget(categories, 'food')).toBe(800);
    expect(groupCategoriesForView(categories, 'expense')[0].totalBudget).toBe(800);
  });
});
