import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, isAfter, isBefore, isEqual, parseISO } from 'date-fns';
import { RecurringFrequency, RecurringTransaction } from './data';

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  DAILY: 'dzień',
  WEEKLY: 'tydzień',
  MONTHLY: 'miesiąc',
  YEARLY: 'rok',
};

export const RECURRING_CATEGORY_META = {
  FIXED_ACCOUNT_FEE: { label: 'Opłata za konto', icon: 'credit_card', color: '#0891b2', bg: '#cffafe' },
  SUBSCRIPTION: { label: 'Subskrypcja', icon: 'play_circle', color: '#7c3aed', bg: '#ede9fe' },
  BILL: { label: 'Rachunek', icon: 'home', color: '#2563eb', bg: '#dbeafe' },
  INSURANCE: { label: 'Ubezpieczenie', icon: 'health_and_safety', color: '#0d9488', bg: '#ccfbf1' },
  LOAN: { label: 'Rata / pożyczka', icon: 'autorenew', color: '#d97706', bg: '#fef3c7' },
  SAVINGS: { label: 'Oszczędności', icon: 'savings', color: '#16a34a', bg: '#dcfce7' },
  RENTAL: { label: 'Najem', icon: 'key', color: '#dc2626', bg: '#fee2e2' },
  OTHER: { label: 'Inne', icon: 'more_horiz', color: '#64748b', bg: '#f1f5f9' },
} as const;

function addInterval(date: Date, frequency: RecurringFrequency, interval: number): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(date, interval);
    case 'WEEKLY':
      return addWeeks(date, interval);
    case 'MONTHLY':
      return addMonths(date, interval);
    case 'YEARLY':
      return addYears(date, interval);
  }
}

export function recurringCategoryLabel(recurring: Pick<RecurringTransaction, 'recurringCategory' | 'recurringCategoryLabel'>): string {
  return recurring.recurringCategoryLabel || RECURRING_CATEGORY_META[recurring.recurringCategory].label;
}

export function recurringFrequencyLabel(recurring: Pick<RecurringTransaction, 'frequency' | 'intervalValue'>): string {
  const interval = Math.max(1, recurring.intervalValue);
  const base = FREQUENCY_LABELS[recurring.frequency];
  return interval === 1 ? `Co ${base}` : `Co ${interval} ${base}`;
}

export function monthlyRecurringCost(recurring: Pick<RecurringTransaction, 'amount' | 'frequency' | 'intervalValue'>): number {
  const amount = recurring.amount ?? 0;
  const interval = Math.max(1, recurring.intervalValue);
  switch (recurring.frequency) {
    case 'DAILY':
      return amount * 30 / interval;
    case 'WEEKLY':
      return amount * (30 / 7) / interval;
    case 'MONTHLY':
      return amount / interval;
    case 'YEARLY':
      return amount / (12 * interval);
  }
}

export function nextRecurringDate(recurring: Pick<RecurringTransaction, 'startDate' | 'endDate' | 'lastGeneratedDate' | 'frequency' | 'intervalValue' | 'skippedOccurrenceDates'>, today: Date): string | null {
  const interval = Math.max(1, recurring.intervalValue);
  const skipped = new Set(recurring.skippedOccurrenceDates);
  const endDate = recurring.endDate ? parseISO(recurring.endDate) : null;
  const lastGenerated = recurring.lastGeneratedDate ? parseISO(recurring.lastGeneratedDate) : null;
  let candidate = parseISO(recurring.startDate);

  const floor = lastGenerated && (isAfter(lastGenerated, today) || isEqual(lastGenerated, today))
    ? addInterval(lastGenerated, recurring.frequency, interval)
    : today;

  while (isBefore(candidate, floor)) {
    candidate = addInterval(candidate, recurring.frequency, interval);
  }

  while (skipped.has(format(candidate, 'yyyy-MM-dd'))) {
    candidate = addInterval(candidate, recurring.frequency, interval);
  }

  if (endDate && isAfter(candidate, endDate)) return null;
  return format(candidate, 'yyyy-MM-dd');
}

export function daysUntil(date: string, today: Date): number {
  return differenceInCalendarDays(parseISO(date), today);
}
