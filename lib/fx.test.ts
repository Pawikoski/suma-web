import { describe, expect, it } from 'vitest';
import { convertToBase, parseCurrencyRates, sumInBase } from './fx';

const fx = { base: 'PLN', rates: { USD: 3.65, EUR: 4.25 } };

describe('parseCurrencyRates', () => {
  it('reads the api payload into a rate table', () => {
    expect(parseCurrencyRates({ base_currency: 'PLN', rates: [{ currency_code: 'USD', rate_to_base: 3.65 }, { currency_code: 'EUR', rate_to_base: '4.25' }] }))
      .toEqual({ base: 'PLN', rates: { USD: 3.65, EUR: 4.25 } });
  });

  it('ignores rows without a usable rate and bad payloads', () => {
    expect(parseCurrencyRates({ base_currency: 'PLN', rates: [{ currency_code: 'USD', rate_to_base: 0 }, { currency_code: 'EUR' }, null] }))
      .toEqual({ base: 'PLN', rates: {} });
    expect(parseCurrencyRates(null)).toBeNull();
    expect(parseCurrencyRates({ rates: [] })).toBeNull();
  });
});

describe('convertToBase', () => {
  it('keeps amounts already in the base currency', () => {
    expect(convertToBase(100, 'PLN', 'PLN', null)).toBe(100);
    expect(convertToBase(100, undefined, 'PLN', null)).toBe(100);
  });

  it('converts with the rate and refuses without one', () => {
    expect(convertToBase(1000, 'USD', 'PLN', fx)).toBeCloseTo(3650);
    expect(convertToBase(10, 'GBP', 'PLN', fx)).toBeNull();
    expect(convertToBase(10, 'USD', 'PLN', null)).toBeNull();
    expect(convertToBase(10, 'USD', 'EUR', fx)).toBeNull();
  });
});

describe('sumInBase', () => {
  const rows = [{ a: 1550.5, c: 'USD' }, { a: 500, c: 'USD' }, { a: 100, c: 'PLN' }, { a: 5, c: 'GBP' }];

  it('adds converted amounts and lists the currencies left out', () => {
    const result = sumInBase(rows, row => row.a, row => row.c, 'PLN', fx);

    expect(result.total).toBeCloseTo(2050.5 * 3.65 + 100);
    expect(result.skipped).toEqual(['GBP']);
  });

  it('does not add USD to PLN as they are (K-03)', () => {
    const result = sumInBase(rows.slice(0, 2), row => row.a, row => row.c, 'PLN', fx);

    expect(result.total).not.toBeCloseTo(2050.5);
    expect(result.total).toBeCloseTo(7484.325);
  });
});
