import { describe, expect, it } from 'vitest';
import { inferImportedCategoryHierarchy } from './import-category-hierarchy';

describe('inferImportedCategoryHierarchy', () => {
  it('turns a parenthesized imported category into parent and child names', () => {
    expect(inferImportedCategoryHierarchy('Garaż (narzędzia)')).toEqual({
      parentName: 'Garaż',
      categoryName: 'Narzędzia',
    });
  });

  it('supports explicit hierarchy separators from other apps', () => {
    expect(inferImportedCategoryHierarchy('Dom > remont')).toEqual({
      parentName: 'Dom',
      categoryName: 'Remont',
    });
    expect(inferImportedCategoryHierarchy('Auto / paliwo')).toEqual({
      parentName: 'Auto',
      categoryName: 'Paliwo',
    });
  });

  it('keeps plain names flat', () => {
    expect(inferImportedCategoryHierarchy('Artykuły spożywcze')).toEqual({
      parentName: null,
      categoryName: 'Artykuły spożywcze',
    });
  });

  it('does not create a self-parent category', () => {
    expect(inferImportedCategoryHierarchy('Garaż (garaż)')).toEqual({
      parentName: null,
      categoryName: 'Garaż (garaż)',
    });
  });
});
