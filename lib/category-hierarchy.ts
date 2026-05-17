import { Category } from './data';

export interface CategoryGroup {
  category: Category;
  children: Category[];
  totalSpent: number;
  totalBudget: number | null;
  totalTxCount: number;
}

export interface CategoryBudgetUsage {
  category: Category;
  budget: number;
  spent: number;
  pct: number;
  isSubLimit: boolean;
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
      const ownBudget = visibleById.get(category.id)?.budget ?? category.budget;
      const childBudgetTotal = children.reduce((sum, item) => sum + effectiveCategoryBudget(categories, item.id), 0);

      return {
        category: visibleCategory,
        children,
        totalSpent: totals.reduce((sum, item) => sum + item.spent, 0),
        totalBudget: ownBudget ?? (childBudgetTotal > 0 ? childBudgetTotal : null),
        totalTxCount: totals.reduce((sum, item) => sum + item.txCount, 0),
      };
    })
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder || a.category.name.localeCompare(b.category.name));
}

export function effectiveCategoryBudget(categories: Category[], categoryId: string): number {
  const category = categories.find(item => item.id === categoryId);
  if (!category) return 0;
  if (category.budget !== null) return category.budget;
  return categories
    .filter(item => item.parentCategoryId === categoryId)
    .reduce((sum, child) => sum + effectiveCategoryBudget(categories, child.id), 0);
}

export function categorySubtreeSpent(categories: Category[], categoryId: string): number {
  const ids = categoryAndDescendantIds(categories, categoryId);
  return categories
    .filter(category => ids.has(category.id))
    .reduce((sum, category) => sum + category.spent, 0);
}

export function hasBudgetedAncestor(categories: Category[], categoryId: string): boolean {
  const byId = new Map(categories.map(category => [category.id, category]));
  let parentId = byId.get(categoryId)?.parentCategoryId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (parent?.budget !== null) return true;
    parentId = parent?.parentCategoryId ?? null;
  }
  return false;
}

export function categoryBudgetUsages(categories: Category[]): CategoryBudgetUsage[] {
  return categories
    .filter(category => category.budget !== null && category.budget > 0)
    .map(category => {
      const budget = category.budget!;
      const spent = categorySubtreeSpent(categories, category.id);
      return {
        category,
        budget,
        spent,
        pct: budget > 0 ? spent / budget * 100 : 0,
        isSubLimit: hasBudgetedAncestor(categories, category.id),
      };
    });
}

export function nonOverlappingCategoryBudgetSummary(categories: Category[]) {
  const usages = categoryBudgetUsages(categories).filter(item => !item.isSubLimit);
  return {
    budget: usages.reduce((sum, item) => sum + item.budget, 0),
    spent: usages.reduce((sum, item) => sum + item.spent, 0),
  };
}

export function categoryAndDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const ids = new Set<string>([categoryId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentCategoryId && ids.has(category.parentCategoryId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }

  return ids;
}
