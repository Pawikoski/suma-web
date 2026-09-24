import { describe, expect, it } from 'vitest';
import { categoryIcons, findCategoryIcon, normalizeCategoryIconName } from './category-icons';

describe('category icon catalog', () => {
  it('contains unique renderable options for the full picker', () => {
    expect(categoryIcons.length).toBeGreaterThanOrEqual(280);
    expect(new Set(categoryIcons.map(icon => icon.name)).size).toBe(categoryIcons.length);
    expect(categoryIcons.every(icon => icon.glyph && icon.label)).toBe(true);
  });

  it('normalizes persisted aliases and rejects unknown icons', () => {
    expect(normalizeCategoryIconName('shopping_cart')).toBe('ShoppingCart');
    expect(normalizeCategoryIconName('Health')).toBe('Favorite');
    expect(normalizeCategoryIconName('Fuel')).toBe('LocalGasStation');
    expect(findCategoryIcon('NightLife')?.glyph).toBe('nightlife');
    expect(normalizeCategoryIconName('totally_invalid_icon')).toBeNull();
  });
});
