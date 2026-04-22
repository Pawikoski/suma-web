export const fmtPLN = (n: number, showSign = false): string => {
  const abs = Math.abs(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (showSign) return (n >= 0 ? '+' : '-') + ' ' + abs + ' zł';
  return abs + ' zł';
};

export const fmtShort = (n: number): string =>
  Math.abs(n).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

export const fmtDate = (d: string): string => {
  const map: Record<string, string> = {
    '2026-04-15': '15 kwietnia', '2026-04-14': '14 kwietnia', '2026-04-13': '13 kwietnia',
    '2026-04-12': '12 kwietnia', '2026-04-11': '11 kwietnia', '2026-04-10': '10 kwietnia',
    '2026-04-09': '9 kwietnia',  '2026-04-08': '8 kwietnia',  '2026-04-07': '7 kwietnia',
    '2026-04-05': '5 kwietnia',
  };
  return map[d] ?? d;
};
