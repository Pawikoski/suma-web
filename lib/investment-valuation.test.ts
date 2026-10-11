import { describe, expect, it } from 'vitest';
import { holdingMarketValue, quoteKey, quoteKindFor } from './investment-valuation';

const fx = { base: 'PLN', rates: { USD: 4, EUR: 4.5, PLN: 1 } };
const holding = { symbol: 'iwda.l', investmentType: 'ETF' as const, quantity: 10, currency: 'PLN' };

describe('holdingMarketValue', () => {
  it('uses the quote as is when currencies match', () => {
    const quotes = { [quoteKey('market', 'IWDA.L')]: { price: 60, currency: 'PLN' } };
    expect(holdingMarketValue(holding, quotes, 'PLN', fx)).toBe(600);
  });

  it('converts a foreign quote through the base currency', () => {
    const quotes = { [quoteKey('market', 'IWDA.L')]: { price: 150, currency: 'USD' } };
    expect(holdingMarketValue(holding, quotes, 'PLN', fx)).toBe(6000);
  });

  it('converts into a holding currency other than the base', () => {
    const quotes = { [quoteKey('market', 'IWDA.L')]: { price: 150, currency: 'USD' } };
    expect(holdingMarketValue({ ...holding, currency: 'EUR' }, quotes, 'PLN', fx)).toBeCloseTo(6000 / 4.5);
  });

  it('is null without a quote or without a rate', () => {
    expect(holdingMarketValue(holding, {}, 'PLN', fx)).toBeNull();
    const quotes = { [quoteKey('market', 'IWDA.L')]: { price: 150, currency: 'CHF' } };
    expect(holdingMarketValue(holding, quotes, 'PLN', fx)).toBeNull();
    const usd = { [quoteKey('market', 'IWDA.L')]: { price: 150, currency: 'USD' } };
    expect(holdingMarketValue(holding, usd, 'PLN', null)).toBeNull();
  });

  it('keeps crypto and market quotes apart', () => {
    expect(quoteKindFor('CRYPTO')).toBe('crypto');
    expect(quoteKindFor('PRECIOUS_METAL')).toBe('market');
    const quotes = { [quoteKey('market', 'SUI')]: { price: 114, currency: 'USD' } };
    expect(holdingMarketValue({ symbol: 'SUI', investmentType: 'CRYPTO', quantity: 1, currency: 'PLN' }, quotes, 'PLN', fx)).toBeNull();
  });
});
