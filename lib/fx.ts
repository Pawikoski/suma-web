/** Exchange rates to the base (main) currency, as served by suma-api `/api/currency-rates/?base=<base>`. */
export interface FxRates {
  base: string;
  /** `rates[code]` is the value of one unit of `code` in `base`. */
  rates: Record<string, number>;
}

export function parseCurrencyRates(payload: unknown): FxRates | null {
  if (!payload || typeof payload !== 'object') return null;
  const { base_currency: base, rates } = payload as { base_currency?: unknown; rates?: unknown };
  if (typeof base !== 'string' || !Array.isArray(rates)) return null;
  const table: Record<string, number> = {};
  for (const row of rates) {
    if (!row || typeof row !== 'object') continue;
    const { currency_code: code, rate_to_base: rate } = row as { currency_code?: unknown; rate_to_base?: unknown };
    const value = typeof rate === 'string' ? parseFloat(rate) : rate;
    if (typeof code === 'string' && typeof value === 'number' && Number.isFinite(value) && value > 0) table[code] = value;
  }
  return { base, rates: table };
}

/** The amount in the base currency, or null when there is no rate for it. */
export function convertToBase(amount: number, currency: string | null | undefined, base: string, fx: FxRates | null): number | null {
  if (!currency || currency === base) return amount;
  if (!fx || fx.base !== base) return null;
  const rate = fx.rates[currency];
  return rate ? amount * rate : null;
}

export interface BaseTotals {
  total: number;
  /** Currencies that could not be converted and are left out of the total. */
  skipped: string[];
}

export function sumInBase<T>(
  items: T[],
  amountOf: (item: T) => number,
  currencyOf: (item: T) => string | null | undefined,
  base: string,
  fx: FxRates | null,
): BaseTotals {
  let total = 0;
  const skipped = new Set<string>();
  for (const item of items) {
    const converted = convertToBase(amountOf(item), currencyOf(item), base, fx);
    if (converted === null) skipped.add(currencyOf(item) ?? '');
    else total += converted;
  }
  return { total, skipped: [...skipped].sort() };
}
