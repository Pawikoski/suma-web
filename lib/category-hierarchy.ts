import { Category } from './data';

export interface CategoryGroup {
  category: Category;
  children: Category[];
  totalSpent: number;
  totalBudget: number | null;
  totalTxCount: number;
}

function matchesView(category: Category, view: string) {
  if (view === 'all') return true;
  return category.types.includes(view.toUpperCase());
}

export function groupCategoriesForView(categories: Category[], view: string): CategoryGroup[] {
  const visible = categories.filter(category => matchesView(category, view));
  const visibleById = new Map(visible.map(category => [category.id, category]));
  const allById = new Map(categories.map(category => [category.id, category]));
  const childrenByParent = new Map<string, Category[]>();

  for (const category of visible) {
    if (!category.parentCategoryId) continue;
    const children = childrenByParent.get(category.parentCategoryId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentCategoryId, children);
  }

  const rootCandidates = categories.filter(category => {
    if (!matchesView(category, view) && !childrenByParent.has(category.id)) return false;
    return !category.parentCategoryId || !allById.has(category.parentCategoryId);
  });

  return rootCandidates
    .map(category => {
      const visibleCategory = visibleById.get(category.id) ?? category;
      const children = (childrenByParent.get(category.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      const totals = [visibleById.get(category.id), ...children].filter(Boolean) as Category[];

      return {
        category: visibleCategory,
        children,
        totalSpent: totals.reduce((sum, item) => sum + item.spent, 0),
        totalBudget: totals.some(item => item.budget !== null)
          ? totals.reduce((sum, item) => sum + (item.budget ?? 0), 0)
          : null,
        totalTxCount: totals.reduce((sum, item) => sum + item.txCount, 0),
      };
    })
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder || a.category.name.localeCompare(b.category.name));
}
