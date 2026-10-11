import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvestmentsScreen from './InvestmentsScreen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/investments',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/app/actions/sync', () => ({
  createInvestmentHoldingAction: vi.fn(),
  deleteInvestmentHoldingAction: vi.fn(),
  tradeInvestmentHoldingAction: vi.fn(),
  updateInvestmentHoldingAction: vi.fn(),
}));

vi.mock('@/lib/useActiveMonthData', () => ({
  useActiveMonthData: vi.fn(),
}));

vi.mock('@/app/actions/prices', () => ({
  fetchHoldingQuotesAction: vi.fn(),
  searchInstrumentsAction: vi.fn(),
}));

vi.mock('@/lib/AppDataContext', () => ({
  useAppData: () => ({ fxRates: { base: 'PLN', rates: { USD: 4 } } }),
}));

import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { fetchHoldingQuotesAction, searchInstrumentsAction } from '@/app/actions/prices';

const mockedUseActiveMonthData = vi.mocked(useActiveMonthData);
const mockedFetchQuotes = vi.mocked(fetchHoldingQuotesAction);
const mockedSearch = vi.mocked(searchInstrumentsAction);

const account = {
  id: 'acc-invest',
  name: 'Broker',
  type: 'Inwestycje',
  rawType: 'INVESTMENT',
  balance: 100,
  currency: 'PLN',
  color: '#8B5CF6',
  color2: '#C4B5FD',
  icon: 'ShowChart',
  category: 'BASIC',
  sortOrder: 1,
  includeInNetWorth: true,
  notes: null,
  liabilityKind: null,
  creditLimit: null,
  statementDay: null,
  paymentDueDay: null,
  liabilityPrincipal: null,
  liabilityMonthlyPayment: null,
  paymentAccountId: null,
  creditCardLast4: null,
  creditCardTheme: null,
  updatedAt: '2026-05-10T10:00:00Z',
  deletedAt: null,
  version: 1,
};

const holding = {
  id: 'holding-aapl',
  accountId: 'acc-invest',
  accountName: 'Broker',
  symbol: 'AAPL',
  name: 'Apple',
  investmentType: 'STOCK',
  quantity: 2,
  unitPrice: 100,
  value: 200,
  currency: 'PLN',
  purchaseCurrency: 'PLN',
  notes: '',
  transactions: [
    {
      id: 'tx-open',
      holdingId: 'holding-aapl',
      type: 'BUY',
      quantity: 2,
      unitPrice: 100,
      currency: 'PLN',
      date: '2026-05-10',
      notes: '',
      updatedAt: '2026-05-10T10:00:00Z',
      deletedAt: null,
      version: 1,
    },
  ],
  updatedAt: '2026-05-10T10:00:00Z',
  deletedAt: null,
  version: 1,
};

function mockPortfolioData(overrides: Record<string, unknown> = {}) {
  mockedUseActiveMonthData.mockReturnValue({
    accounts: [account],
    categories: [],
    transactions: [],
    allTransactions: [],
    recurringTransactions: [],
    investmentHoldings: [holding],
    accountInterest: [],
    accountBudgets: [],
    settlements: [],
    overallBudget: null,
    overallBudgetRecord: null,
    yearMonth: '2026-05',
    syncError: null,
    userEmail: 'root@root.com',
    activeMonth: '2026-05',
    setActiveMonthParam: vi.fn(),
    availableMonths: ['2026-05'],
    baseCurrency: 'PLN',
    ...overrides,
  } as never);
}

describe('InvestmentsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchQuotes.mockResolvedValue({});
    mockedSearch.mockResolvedValue([]);
    mockPortfolioData();
  });

  it('values a position at its live quote and shows the result against cost', async () => {
    mockedFetchQuotes.mockResolvedValue({ 'market:AAPL': { price: 75, currency: 'USD' } });
    render(<InvestmentsScreen />);

    // 2 x 75 USD x 4 = 600 zł instead of the 200 zł cost
    expect((await screen.findAllByText('600,00 zł')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('400,00 zł').length).toBeGreaterThan(0);
    expect(mockedFetchQuotes).toHaveBeenCalledWith({
      holdings: [{ investmentType: 'STOCK', symbol: 'AAPL' }],
      currency: 'PLN',
    });
  });

  it('labels positions without a quote as valued at cost', async () => {
    render(<InvestmentsScreen />);

    expect(await screen.findByText(/1 poz\. wycenione po koszcie/)).toBeVisible();
    expect(screen.getByText(/wg kosztu/)).toBeVisible();
  });

  it('shows total value, invested value, and free cash separately', () => {
    render(<InvestmentsScreen />);

    expect(screen.getByText('Wartość łączna')).toBeVisible();
    expect(screen.getByText('Pozycje inwestycyjne')).toBeVisible();
    expect(screen.getByText('Wolne środki')).toBeVisible();
    expect(screen.getByText('300,00 zł')).toBeVisible();
    expect(screen.getAllByText('200,00 zł').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100,00 zł').length).toBeGreaterThan(0);
  });

  it('blocks buy operations above available free cash in the UI', async () => {
    const user = userEvent.setup();
    render(<InvestmentsScreen />);

    await user.click(screen.getByRole('button', { name: 'Kup' }));
    await user.clear(screen.getByLabelText('Ilość operacji'));
    await user.type(screen.getByLabelText('Ilość operacji'), '2');

    expect(screen.getByText('Brak wystarczających wolnych środków na tym koncie.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Zapisz kupno' })).toBeDisabled();
  });

  it('explains that opening a holding does not spend free cash', async () => {
    const user = userEvent.setup();
    mockPortfolioData({ investmentHoldings: [] });
    render(<InvestmentsScreen />);

    await user.click(screen.getAllByRole('button', { name: 'Dodaj pozycję' })[0]);

    expect(screen.getByText(/nie zmieni wolnych środków konta/i)).toBeVisible();
  });

  it('searches instruments while typing and fills the position from the picked one', async () => {
    const user = userEvent.setup();
    mockPortfolioData({ investmentHoldings: [] });
    mockedSearch.mockResolvedValue([
      { symbol: 'IWDA.L', name: 'iShares Core MSCI World UCITS ETF', exchange: 'London', currency: 'USD', type: 'ETF' },
    ]);
    mockedFetchQuotes.mockResolvedValue({ 'market:IWDA.L': { price: 150, currency: 'USD' } });
    render(<InvestmentsScreen />);

    await user.click(screen.getAllByRole('button', { name: 'Dodaj pozycję' })[0]);
    await user.type(screen.getByLabelText('Symbol'), 'iwda');
    await user.click(await screen.findByRole('option', { name: /iShares Core MSCI World/ }));

    expect(screen.getByLabelText('Symbol')).toHaveValue('IWDA.L');
    expect(screen.getByLabelText('Typ inwestycji')).toHaveValue('ETF');
    // 150 USD x 4 = 600 zł per unit
    await vi.waitFor(() => expect(screen.getByLabelText('Cena jednostki')).toHaveValue(600));
    expect(mockedSearch).toHaveBeenCalledWith({ query: 'IWDA', investmentType: 'STOCK' });
  });

  it('links the empty no-account state back to accounts', () => {
    mockPortfolioData({ accounts: [], investmentHoldings: [] });
    render(<InvestmentsScreen />);

    expect(screen.getByRole('heading', { name: 'Brak kont inwestycyjnych' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Przejdź do kont' })).toBeVisible();
  });
});
