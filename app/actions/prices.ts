'use server';
import { z } from 'zod';
import { fetchAssetQuotes } from '@/lib/api';
import { quoteKey, quoteKindFor } from '@/lib/investment-valuation';

const inputSchema = z.object({
  holdings: z.array(z.object({
    symbol: z.string().trim().min(1).max(64),
    investmentType: z.enum(['STOCK', 'ETF', 'CRYPTO', 'PRECIOUS_METAL']),
  })).max(100),
  currency: z.string().trim().length(3),
});

export type HoldingQuotes = Record<string, { price: number; currency: string }>;

/**
 * Live quotes for the given holdings, keyed by `quoteKey`. Crypto and market symbols are asked
 * for in their own namespace (SUI or OP are also stock tickers). Failures yield fewer quotes,
 * never an error: the screen then keeps valuing those positions at cost.
 */
export async function fetchHoldingQuotesAction(input: unknown): Promise<HoldingQuotes> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return {};
  const { holdings, currency } = parsed.data;
  const result: HoldingQuotes = {};
  for (const kind of ['crypto', 'market'] as const) {
    const symbols = [...new Set(holdings.filter(h => quoteKindFor(h.investmentType) === kind).map(h => h.symbol.toUpperCase()))];
    if (symbols.length === 0) continue;
    try {
      for (const quote of await fetchAssetQuotes(symbols, kind, currency.toUpperCase())) {
        result[quoteKey(kind, quote.symbol)] = { price: quote.price, currency: quote.currency };
      }
    } catch {
      // keep what was fetched so far
    }
  }
  return result;
}
