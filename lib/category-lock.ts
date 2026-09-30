import type { Category } from './data';

/** Shown when a Free-plan category lock blocks picking a category (N-14). */
export const LOCKED_CATEGORY_MESSAGE =
  'Ta kategoria jest zablokowana w planie Free. Wybierz inną albo odblokuj ją w aplikacji Suma.';

/**
 * Categories that can be picked for a new transaction or a changed category.
 * A locked category stays visible in history; `keepId` keeps the one already
 * assigned to an edited transaction so editing other fields still works.
 */
export function selectableCategories<T extends Pick<Category, 'id' | 'isLocked'>>(
  categories: T[],
  keepId?: string | null
): T[] {
  return categories.filter(category => !category.isLocked || category.id === keepId);
}
