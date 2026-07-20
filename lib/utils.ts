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
