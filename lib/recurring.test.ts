import { describe, expect, it } from 'vitest';
import { monthlyRecurringCost, nextRecurringDate, recurringFrequencyLabel } from './recurring';

const baseRecurring = {
  amount: 120,
  frequency: 'MONTHLY' as const,
  intervalValue: 1,
  startDate: '2026-05-01',
  endDate: null,
  lastGeneratedDate: null,
  skippedOccurrenceDates: [],
};

describe('recurring helpers', () => {
  it('normalizes recurring cost to a monthly burden', () => {
    expect(monthlyRecurringCost(baseRecurring)).toBe(120);
    expect(monthlyRecurringCost({ ...baseRecurring, amount: 12, frequency: 'WEEKLY', intervalValue: 1 })).toBeCloseTo(51.43, 2);
    expect(monthlyRecurringCost({ ...baseRecurring, amount: 1200, frequency: 'YEARLY', intervalValue: 1 })).toBe(100);
  });

  it('finds the next unskipped occurrence', () => {
    expect(nextRecurringDate({
      ...baseRecurring,
      skippedOccurrenceDates: ['2026-06-01'],
    }, new Date('2026-05-15T12:00:00'))).toBe('2026-07-01');
  });

  it('formats interval labels for compact UI', () => {
    expect(recurringFrequencyLabel(baseRecurring)).toBe('Co miesiąc');
    expect(recurringFrequencyLabel({ ...baseRecurring, intervalValue: 2 })).toBe('Co 2 miesiąc');
  });
});
