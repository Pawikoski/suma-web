export interface ImportedCategoryHierarchy {
  parentName: string | null;
  categoryName: string;
}

const SEPARATOR_PATTERN = /\s+(?:>|\/|»|→)\s+/;

function cleanCategoryPart(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function capitalizeCategoryPart(value: string): string {
  const cleaned = cleanCategoryPart(value);
  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toLocaleUpperCase('pl-PL') + cleaned.slice(1);
}

function sameCategoryName(left: string, right: string): boolean {
  return cleanCategoryPart(left).toLocaleLowerCase('pl-PL') === cleanCategoryPart(right).toLocaleLowerCase('pl-PL');
}

export function inferImportedCategoryHierarchy(rawName: string): ImportedCategoryHierarchy {
  const name = cleanCategoryPart(rawName || 'Import');
  const parenthesized = name.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (parenthesized) {
    const parentName = cleanCategoryPart(parenthesized[1]);
    const categoryName = capitalizeCategoryPart(parenthesized[2]);
    if (parentName && categoryName && !sameCategoryName(parentName, categoryName)) {
      return { parentName, categoryName };
    }
  }

  const separated = name.split(SEPARATOR_PATTERN).map(cleanCategoryPart).filter(Boolean);
  if (separated.length >= 2) {
    const parentName = separated[0];
    const categoryName = capitalizeCategoryPart(separated.slice(1).join(' / '));
    if (parentName && categoryName && !sameCategoryName(parentName, categoryName)) {
      return { parentName, categoryName };
    }
  }

  return { parentName: null, categoryName: name };
}
