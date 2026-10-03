import { describe, expect, it } from 'vitest';
import { categoryDisplayName, polishPlural } from './utils';

describe('polishPlural', () => {
  const forms = (n: number) => polishPlural(n, 'transakcja', 'transakcje', 'transakcji');

  it('uses the singular only for 1', () => {
    expect(forms(1)).toBe('transakcja');
  });

  it('uses the few form for 2-4 except the teens', () => {
    [2, 3, 4, 22, 23, 24, 102].forEach(n => expect(forms(n)).toBe('transakcje'));
  });

  it('uses the many form for 0, 5-21 and the teens', () => {
    [0, 5, 11, 12, 13, 14, 15, 21, 25, 100, 112].forEach(n => expect(forms(n)).toBe('transakcji'));
  });
});

describe('categoryDisplayName', () => {
  it('shows the English system category in Polish', () => {
    expect(categoryDisplayName({ name: 'Other', is_system: true })).toBe('Inne');
  });

  it('leaves user categories and renamed system categories alone', () => {
    expect(categoryDisplayName({ name: 'Other', is_system: false })).toBe('Other');
    expect(categoryDisplayName({ name: 'Zakupy', is_system: true })).toBe('Zakupy');
  });
});
