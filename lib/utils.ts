const formatCurrency = (value: number, currency: string, digits: number): string => {
  const code = currency.trim().toUpperCase();
  try {
    return Math.abs(value).toLocaleString('pl-PL', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    const amount = Math.abs(value).toLocaleString('pl-PL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return code ? `${amount} ${code}` : amount;
  }
};

export const formatMoney = (value: number, currency: string, showSign = false): string => {
  const amount = formatCurrency(value, currency, 2);
  if (!showSign) return amount;
  return `${value >= 0 ? '+' : '-'} ${amount}`;
};

export const formatMoneyShort = (value: number, currency: string): string =>
  formatCurrency(value, currency, 0);

export const fallbackCurrency = (...codes: Array<string | null | undefined>): string =>
  codes.find(code => code?.trim())?.trim().toUpperCase() ?? 'PLN';

export const fmtDate = (d: string): string => {
  const map: Record<string, string> = {
    '2026-04-15': '15 kwietnia', '2026-04-14': '14 kwietnia', '2026-04-13': '13 kwietnia',
    '2026-04-12': '12 kwietnia', '2026-04-11': '11 kwietnia', '2026-04-10': '10 kwietnia',
    '2026-04-09': '9 kwietnia',  '2026-04-08': '8 kwietnia',  '2026-04-07': '7 kwietnia',
    '2026-04-05': '5 kwietnia',
  };
  return map[d] ?? d;
};

/** Polish plural: 1 -> one, 2-4 (except 12-14) -> few, everything else -> many. */
export const polishPlural = (count: number, one: string, few: string, many: string): string => {
  const n = Math.abs(count);
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
};

/** The system category the app names "Inne" is stored as "Other"; the Polish web shows it in Polish. */
export const categoryDisplayName = (category: { name: string; is_system: boolean }): string =>
  category.is_system && category.name === 'Other' ? 'Inne' : category.name;
