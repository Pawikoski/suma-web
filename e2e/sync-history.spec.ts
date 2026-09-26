import { randomUUID } from 'node:crypto';
import { expect, test, APIRequestContext } from '@playwright/test';
import { parseSyncResponse, ParsedSyncResponse } from '../lib/schemas/sync';

// Run only against an explicitly supplied disposable local stack.
const api = process.env.SYNC_HTTP_API_URL;
const enabled = api?.startsWith('http://127.0.0.1:') && !!process.env.SYNC_HTTP_EMAIL && !!process.env.SYNC_HTTP_PASSWORD;
test.skip(!enabled, 'Requires a disposable local API and synthetic account.');
test.describe.configure({ mode: 'serial' });
let authorization: string;

async function sync(request: APIRequestContext, changes: Record<string, unknown> = {}) {
  let cursor = 0;
  let restoreToken: string | null = null;
  let generation = 0;
  let result: ParsedSyncResponse | undefined;
  for (let page = 0; page < 30; page++) {
    const response = await request.post(`${api}/api/sync/`, { headers: { Authorization: authorization }, data: {
      schema_version: 3, client_id: 'web-browser-release-test', request_id: randomUUID(),
      changes, restore_cursor: cursor, restore_sync_token: restoreToken, sync_reset_generation: generation,
    } });
    expect(response.ok()).toBe(true);
    const parsed = parseSyncResponse(await response.json());
    generation = parsed.sync_reset_generation;
    if (parsed.reset_required) continue;
    expect(parsed.errors).toEqual([]);
    changes = {};
    if (!result) result = parsed;
    else {
      result.server_changes.transactions.push(...parsed.server_changes.transactions);
      result.server_changes.accounts.push(...parsed.server_changes.accounts);
    }
    if (!parsed.has_more) return result;
    cursor = parsed.next_restore_cursor!;
    restoreToken = parsed.restore_sync_token;
  }
  throw new Error('Fixture snapshot did not finish');
}

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${api}/api/auth/login/`, { data: { email: process.env.SYNC_HTTP_EMAIL, password: process.env.SYNC_HTTP_PASSWORD } });
  expect(login.ok()).toBe(true);
  authorization = `Bearer ${(await login.json()).access}`;
});

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return host === 'localhost' || host === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/login');
  await page.getByPlaceholder('jan@kowalski.pl').fill(process.env.SYNC_HTTP_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SYNC_HTTP_PASSWORD!);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.waitForURL('**/');
});

test('edits historical notes and explicitly resolves destination with correct real balances', async ({ page, request }) => {
  const initial = await sync(request);
  const source = initial.server_changes.accounts.find(a => a.name === 'HTTP web release')!;
  const destination = initial.server_changes.accounts.find(a => a.name === 'HTTP destination')!;
  const balance = Number(destination.balance);
  const id = randomUUID();
  const date = new Date().toISOString();
  await sync(request, { transactions: [{ id, version: 1, updated_at: date, date_time: date, type: 'TRANSFER',
    from_account_id: source.id, to_account_id: null, total_amount: '13.37', account_currency: 'PLN',
    to_account_amount: '2.33', to_account_currency: 'EUR', account_link_state: 'MISSING_DESTINATION',
    missing_destination_reason: 'LEGACY', review_status: 'APPROVED', notes: 'Browser history test' }] });
  await page.goto(`/transactions?id=${id}&month=${date.slice(0, 7)}`);
  await expect(page.getByText(/Historyczny przelew bez konta docelowego/)).toBeVisible();
  await page.getByLabel('Edytuj transakcję').click();
  await expect(page.getByLabel('Konto docelowe transakcji')).toHaveValue('');
  await page.getByLabel('Notatka transakcji').fill('Browser note preserved');
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByText('Transakcja została zaktualizowana.')).toBeVisible();
  const noted = await sync(request);
  expect(noted.server_changes.transactions.find(t => t.id === id)).toMatchObject({ notes: 'Browser note preserved', account_link_state: 'MISSING_DESTINATION', to_account_id: null, to_account_amount: '2.33' });
  expect(Number(noted.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balance, 2);
  await page.reload();
  await page.getByLabel('Edytuj transakcję').click();
  await page.getByLabel('Konto docelowe transakcji').selectOption(destination.id);
  await expect(page.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Przypisanie celu zmieni saldo/ }).check();
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByText('Transakcja została zaktualizowana.')).toBeVisible();
  const resolved = await sync(request);
  expect(resolved.server_changes.transactions.find(t => t.id === id)).toMatchObject({ account_link_state: 'COMPLETE', missing_destination_reason: null, to_account_id: destination.id });
  expect(Number(resolved.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balance + 2.33, 2);
});

test('retries a lost import response without duplicating history and preserves all currencies', async ({ page, request }) => {
  const before = await sync(request);
  const note = `Browser CSV ${randomUUID()}`;
  const csv = 'ID,Date,Type,From Account,To Account/Category,Amount,Currency,Account Amount,Account Currency,Notes,Location,Account Link State,Destination Amount,Destination Currency,Missing Destination Reason\n' +
    `1,2026-09-26,TRANSFER,HTTP web release,Unknown Account,1.00,EUR,4.00,PLN,${note},,MISSING_DESTINATION,2.33,EUR,LEGACY\n`;
  await page.goto('/import-export');
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-history.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('heading', { name: 'Konta importowanych transakcji' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zatwierdź import' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Zachowaj 1 historycznych/ }).check();
  let loseResult = true;
  await page.route('http://localhost:3000/import-export*', async route => {
    if (loseResult && route.request().method() === 'POST' && route.request().headers()['next-action']) {
      loseResult = false;
      await route.fetch();
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Zatwierdź import' }).click();
  await expect(page.getByRole('button', { name: 'Ponów tę samą próbę' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zatwierdź import' })).toBeDisabled();
  await page.getByRole('button', { name: 'Ponów tę samą próbę' }).click();
  await expect(page.getByText('Import został wcześniej zapisany.')).toBeVisible();
  const after = await sync(request);
  expect(after.server_changes.accounts).toHaveLength(before.server_changes.accounts.length);
  expect(after.server_changes.transactions.filter(t => t.notes === note)).toHaveLength(1);
  expect(after.server_changes.transactions.find(t => t.notes === note)).toMatchObject({
    total_amount: '4.00', account_currency: 'PLN', transaction_amount: '1.00', transaction_currency: 'EUR',
    account_link_state: 'MISSING_DESTINATION', missing_destination_reason: 'LEGACY', to_account_amount: '2.33', to_account_currency: 'EUR', to_account_id: null,
  });
});

test('keeps one transaction after losing the browser action response and retrying the draft', async ({ page, request }) => {
  const before = await sync(request);
  const source = before.server_changes.accounts.find(a => a.name === 'HTTP web release')!;
  const note = `Browser retried creation ${randomUUID()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Dodaj transakcję', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Nowa transakcja' });
  await modal.getByLabel('Konto', { exact: true }).selectOption(source.id);
  await modal.getByLabel('Notatka', { exact: true }).fill(note);
  await modal.getByRole('button', { name: '7', exact: true }).click();
  let loseResult = true;
  await page.route('http://localhost:3000/', async route => {
    if (loseResult && route.request().method() === 'POST' && route.request().headers()['next-action']) {
      loseResult = false;
      await route.fetch();
      return route.abort('failed');
    }
    return route.continue();
  });
  await modal.getByRole('button', { name: '✓', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Ponów tę samą próbę' })).toBeVisible();
  await expect(modal.getByLabel('Notatka', { exact: true })).toBeDisabled();
  const marker = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('suma:pending:') && key.endsWith(':transaction'))!;
    return { key, value: localStorage.getItem(key)! };
  });
  await modal.getByRole('button', { name: 'Ponów tę samą próbę' }).click();
  await expect(page.getByText('Transakcja została wcześniej zapisana.')).toBeVisible();
  const after = await sync(request);
  expect(after.server_changes.transactions.filter(t => t.notes === note)).toHaveLength(1);
  expect(Number(after.server_changes.accounts.find(a => a.id === source.id)!.balance)).toBeCloseTo(Number(source.balance) - 7, 2);
  // Restore the exact persisted marker to exercise a reload before acknowledgement.
  await page.evaluate(marker => localStorage.setItem(marker.key, marker.value), marker);
  await page.reload();
  await page.getByRole('button', { name: 'Dodaj transakcję', exact: true }).click();
  await expect(modal.getByLabel('Notatka', { exact: true })).toBeDisabled();
  await expect(modal.getByRole('button', { name: 'Ponów tę samą próbę' })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Sprawdź wynik na serwerze' }).click();
  await expect(modal).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), marker.key)).toBeNull();
});

test('maps a missing source in preview before allowing an atomic import', async ({ page, request }) => {
  const note = `Browser mapped source ${randomUUID()}`;
  const csv = 'ID,Date,Type,From Account,To Account/Category,Amount,Currency,Account Amount,Account Currency,Notes,Location\n' +
    `1,2026-09-26,EXPENSE,,HTTP web release,3.00,PLN,3.00,PLN,${note},\n`;
  await page.goto('/import-export');
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-source.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('Przypisz konto źródłowe: 1 transakcji.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zatwierdź import' })).toBeDisabled();
  await page.getByLabel('Źródło: brak w pliku (PLN)', { exact: true }).fill('HTTP web release');
  await page.getByRole('button', { name: 'Zatwierdź import' }).click();
  await expect(page.getByText('Zaimportowano transakcje: 1.')).toBeVisible();
  const after = await sync(request);
  const source = after.server_changes.accounts.find(a => a.name === 'HTTP web release')!;
  expect(after.server_changes.transactions.find(t => t.notes === note)).toMatchObject({ from_account_id: source.id, total_amount: '3.00', type: 'EXPENSE' });
});
