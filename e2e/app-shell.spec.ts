import { expect, Page, test } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('jan@kowalski.pl').fill('root@root.com');
  await page.locator('input[name="password"]').fill('root1234!');
  await page.getByRole('button', { name: /Zaloguj/ }).click();
  await page.waitForURL('**/');
}

test('mobile shell keeps navigation usable and exposes privacy mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await expect(page.getByRole('navigation', { name: 'Główna nawigacja' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dodaj transakcję' })).toBeVisible();

  await page.getByRole('button', { name: 'Ukryj kwoty' }).click();
  await expect(page.getByRole('button', { name: 'Pokaż kwoty' })).toBeVisible();
});

test('mobile more menu exposes secondary workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await page.getByRole('button', { name: 'Więcej' }).click();
  await expect(page.getByRole('menu', { name: 'Więcej ekranów' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Inwestycje' }).click();

  await expect(page).toHaveURL(/\/investments\?month=2026-05/);
  await expect(page.getByRole('heading', { name: 'Brak inwestycji' }).or(page.getByText('Wartość portfela'))).toBeVisible();
});

test('command search navigates to app views', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Szukaj' }).click();
  await page.getByRole('combobox', { name: 'Szukaj w Suma' }).fill('budżet');
  await page.locator('[cmdk-item][data-value="widok Budżet"]').click();

  await expect(page).toHaveURL(/\/budget\?month=2026-05$/);
  await expect(page.getByText('Budżet ogólny')).toBeVisible();
});

test('persists selected month in the URL', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Poprzedni miesiąc' }).click();

  await expect(page).toHaveURL(/month=2026-04/);
  await page.getByRole('link', { name: 'Budżet' }).click();
  await expect(page).toHaveURL(/\/budget\?month=2026-04/);
});

test('opens add transaction sheet in the selected month', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await page.getByRole('button', { name: 'Poprzedni miesiąc' }).click();
  await page.getByRole('button', { name: 'Dodaj transakcję' }).click();

  await expect(page.getByRole('dialog', { name: 'Nowa transakcja' })).toBeVisible();
  await expect(page.getByLabel('Data transakcji')).toHaveValue('2026-04-15');
});

test('opens transactions filtered by category from categories screen', async ({ page }) => {
  await login(page);

  await page.goto('/categories?month=2026-05');
  await page.getByText('Other').first().click();

  await expect(page).toHaveURL(/\/transactions\?category=.*&month=2026-05/);
});

test('opens category creation and edit dialogs', async ({ page }) => {
  await login(page);
  await page.goto('/categories?month=2026-05');

  await page.getByRole('button', { name: 'Dodaj kategorię' }).click();
  await expect(page.getByRole('dialog', { name: 'Nowa kategoria' })).toBeVisible();
  await expect(page.getByLabel('Nazwa kategorii')).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij' }).click();

  const editButton = page.locator('button[aria-label^="Edytuj kategorię"]:not([disabled])').first();
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(page.getByRole('dialog', { name: 'Edycja kategorii' })).toBeVisible();
});

test('opens recurring payments from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Opłaty stałe' }).click();

  await expect(page).toHaveURL(/\/recurring\?month=2026-05/);
  await expect(page.getByText(/Miesięczne obciążenie|Brak opłat stałych/)).toBeVisible();
});

test('opens recurring payment creation dialog', async ({ page }) => {
  await login(page);
  await page.goto('/recurring?month=2026-05');

  await page.getByRole('button', { name: 'Dodaj opłatę stałą' }).click();

  await expect(page.getByRole('dialog', { name: 'Nowa opłata stała' })).toBeVisible();
  await expect(page.getByLabel('Kwota opłaty stałej')).toBeVisible();
  await expect(page.getByLabel('Częstotliwość opłaty stałej')).toBeVisible();
});

test('opens settlements from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Rozliczenia' }).click();

  await expect(page).toHaveURL(/\/settlements\?month=2026-05/);
  await expect(page.getByRole('heading', { name: 'Brak rozliczeń' }).or(page.getByText('Bilans rozliczeń'))).toBeVisible();
});

test('opens settlement creation dialog', async ({ page }) => {
  await login(page);
  await page.goto('/settlements?month=2026-05');

  await page.getByRole('button', { name: 'Dodaj rozliczenie' }).click();

  await expect(page.getByRole('dialog', { name: 'Nowe rozliczenie' })).toBeVisible();
  await expect(page.getByLabel('Osoba rozliczenia')).toBeVisible();
  await expect(page.getByLabel('Kwota rozliczenia')).toBeVisible();
});

test('opens reports from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Raporty' }).click();

  await expect(page).toHaveURL(/\/reports\?month=2026-05/);
  await expect(page.getByText('Trend miesięczny')).toBeVisible();
  await expect(page.getByText('Kategorie wydatków')).toBeVisible();
});

test('opens investments from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Inwestycje' }).click();

  await expect(page).toHaveURL(/\/investments\?month=2026-05/);
  await expect(page.getByRole('heading', { name: 'Brak inwestycji' }).or(page.getByText('Wartość portfela'))).toBeVisible();
});

test('opens import and export workspace from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Import/eksport' }).click();

  await expect(page).toHaveURL(/\/import-export\?month=2026-05/);
  await expect(page.getByRole('link', { name: 'Pobierz JSON' })).toBeVisible();
  await expect(page.getByText('Wybierz plik')).toBeVisible();
});

test('previews analyzed import rows without saving them', async ({ page }) => {
  await login(page);
  await page.route('**/api/imports/analyze', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source_app: 'Test CSV',
        source_format: 'csv',
        confidence: 0.88,
        transactions: [
          {
            date: '2026-05-10',
            type: 'EXPENSE',
            from_account: 'Cash',
            to_category: 'Food',
            to_account: null,
            amount: 42.5,
            currency: 'PLN',
            amount2: null,
            currency2: null,
            notes: 'Lunch',
          },
        ],
        accounts: [{ name: 'Cash', balance: null, currency: 'PLN' }],
      }),
    });
  });

  await page.goto('/import-export?month=2026-05');
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/imports/analyze') && response.status() === 200),
    page.locator('input[type="file"]').setInputFiles({
      name: 'sample.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,amount,notes\n2026-05-10,-42.50,Lunch\n'),
    }),
  ]);

  await expect(page.getByText('sample.csv')).toBeVisible();
  await expect(page.getByText('88%')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zatwierdź import' })).toBeVisible();
});

test('opens account details from command search with URL state', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Szukaj' }).click();
  await page.getByRole('combobox', { name: 'Szukaj w Suma' }).fill('Cash');
  await page.locator('[cmdk-item][data-value^="konto Cash"]').click();

  await expect(page).toHaveURL(/\/accounts\?account=.*&month=2026-05/);
  await expect(page.getByText('Historia — Cash')).toBeVisible();
});

test('opens account creation and edit dialogs', async ({ page }) => {
  await login(page);
  await page.goto('/accounts?month=2026-05');

  await page.getByRole('button', { name: 'Dodaj konto' }).click();
  await expect(page.getByRole('dialog', { name: 'Nowe konto' })).toBeVisible();
  await expect(page.getByLabel('Nazwa konta')).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij' }).click();

  await page.getByRole('button', { name: 'Edytuj konto' }).click();
  await expect(page.getByRole('dialog', { name: 'Edycja konta' })).toBeVisible();
  await expect(page.getByLabel('Saldo konta')).toBeVisible();
  await expect(page.getByLabel('Włącz oprocentowanie')).toBeVisible();
});
