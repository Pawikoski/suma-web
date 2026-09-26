import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TxDetailPanel } from './TransactionsScreen';
import { Account, Transaction } from '@/lib/data';
import { updateTransactionAction } from '@/app/actions/sync';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/app/actions/sync', () => ({ updateTransactionAction: vi.fn(), deleteTransactionAction: vi.fn(), deleteTransactionsAction: vi.fn() }));

const account: Account = { id: 'source', name: 'Bank', type: 'Bank', rawType: 'BANK', balance: 100, currency: 'PLN',
  color: '#111111', color2: '#222222', icon: 'Wallet', category: 'BASIC', sortOrder: 1, includeInNetWorth: true,
  notes: null, liabilityKind: null, creditLimit: null, statementDay: null, paymentDueDay: null, liabilityPrincipal: null,
  liabilityMonthlyPayment: null, paymentAccountId: null, creditCardLast4: null, creditCardTheme: null,
  updatedAt: '2026-09-08T12:00:00Z', deletedAt: null, version: 3 };
const tx: Transaction = { id: 'tx', date: '2026-09-08', dateTime: '2026-09-08T12:00:00Z', cat: 'Transfer', catIcon: 'SwapHoriz',
  catBg: '#ffffff', catColor: '#000000', categoryId: null, desc: 'History', acc: 'Bank', accountId: 'source', toAccountId: null,
  toAccountName: null, accountLinkState: 'MISSING_DESTINATION', missingDestinationReason: 'LEGACY', toAccountAmount: 13.37,
  toAccountCurrency: 'PLN', currency: 'PLN', amount: 13.37, rawAmount: 13.37, type: 'transfer', countInSummary: true,
  isFromNotificationParser: false, reviewStatus: 'APPROVED', parserNotificationKey: null, splitIds: [], splits: [], photos: [],
  updatedAt: '2026-09-08T12:00:00Z', deletedAt: null, version: 3 };

beforeEach(() => { vi.clearAllMocks(); vi.mocked(updateTransactionAction).mockResolvedValue({ ok: true }); });

it('does not preselect a fake destination when editing a historical transfer', async () => {
  const user = userEvent.setup();
  render(<TxDetailPanel tx={tx} accounts={[account, { ...account, id: 'other', name: 'Savings' }]} categories={[]} activeMonth="2026-09" onClose={vi.fn()} />);
  await user.click(screen.getByLabelText('Edytuj transakcję'));
  expect(screen.getByLabelText('Konto docelowe transakcji')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
  expect(updateTransactionAction).toHaveBeenCalledWith(expect.objectContaining({ toAccountId: '', expectedVersion: 3, confirmDestinationBalanceChange: false }));
});

it('shows balance impact and requires confirmation before resolving the destination', async () => {
  const user = userEvent.setup();
  render(<TxDetailPanel tx={tx} accounts={[account, { ...account, id: 'other', name: 'Savings' }]} categories={[]} activeMonth="2026-09" onClose={vi.fn()} />);
  await user.click(screen.getByLabelText('Edytuj transakcję'));
  await user.selectOptions(screen.getByLabelText('Konto docelowe transakcji'), 'other');
  expect(screen.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled();
  expect(screen.getByText(/Przypisanie celu zmieni saldo/)).toBeVisible();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
  expect(updateTransactionAction).toHaveBeenCalledWith(expect.objectContaining({ toAccountId: 'other', confirmDestinationBalanceChange: true }));
});
