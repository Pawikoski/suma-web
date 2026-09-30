import { describe, expect, it } from 'vitest';
import { selectableCategories } from './category-lock';

describe('selectableCategories', () => {
  const categories = [
    { id: 'food', isLocked: false },
    { id: 'pets', isLocked: true },
    { id: 'travel', isLocked: false },
  ];

  it('hides Free-plan locked categories from new choices', () => {
    expect(selectableCategories(categories).map(c => c.id)).toEqual(['food', 'travel']);
  });

  it('keeps the locked category already on an edited transaction', () => {
    expect(selectableCategories(categories, 'pets').map(c => c.id)).toEqual(['food', 'pets', 'travel']);
  });
});
