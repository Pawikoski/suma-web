import sections from './category-icons.json';
import aliases from './category-icon-aliases.json';

export const categoryIconSections = sections;
export const categoryIcons = sections.flatMap(section => section.icons);

const iconsByKey = new Map(categoryIcons.map(icon => [icon.name.toLowerCase().replace(/[^a-z0-9]/g, ''), icon]));

const legacyNames: Record<string, string> = { ...aliases, coffee: 'LocalCafe' };

export function findCategoryIcon(name: string) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return iconsByKey.get(key) ?? iconsByKey.get((legacyNames[key] ?? '').toLowerCase());
}

export function normalizeCategoryIconName(name: string): string | null {
  return findCategoryIcon(name)?.name ?? null;
}
