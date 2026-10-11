import type { InvestmentHolding, InvestmentType } from '@/lib/data';
import { convertToBase, type FxRates } from '@/lib/fx';

export type QuoteKind = 'market' | 'crypto';

export function quoteKindFor(type: InvestmentType): QuoteKind {
  return type === 'CRYPTO' ? 'crypto' : 'market';
}

export function quoteKey(kind: QuoteKind, symbol: string): string {
  return `${kind}:${symbol.trim().toUpperCase()}`;
}

export interface Quote {
  price: number;
  currency: string;
}

/**
 * Market value of the holding in its own currency, or null when there is no quote or no rate to
 * convert it (callers then fall back to the cost). The FX table converts into the base currency,
 * so a quote in another currency goes quote -> base -> holding currency.
 */
export function holdingMarketValue(
  holding: Pick<InvestmentHolding, 'symbol' | 'investmentType' | 'quantity' | 'currency'>,
  quotes: Record<string, Quote>,
  base: string,
  fx: FxRates | null,
): number | null {
  const quote = quotes[quoteKey(quoteKindFor(holding.investmentType), holding.symbol)];
  if (!quote) return null;
  const gross = holding.quantity * quote.price;
  if (quote.currency === holding.currency) return gross;
  const inBase = convertToBase(gross, quote.currency, base, fx);
  if (inBase === null) return null;
  if (holding.currency === base) return inBase;
  const rate = fx?.base === base ? fx.rates[holding.currency] : undefined;
  return rate ? inBase / rate : null;
}
