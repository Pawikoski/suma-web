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

test('opens recurring payments from navigation', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Opłaty stałe' }).click();

  await expect(page).toHaveURL(/\/recurring\?month=2026-05/);
  await expect(page.getByText(/Miesięczne obciążenie|Brak opłat stałych/)).toBeVisible();
});

test('opens account details from command search with URL state', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Szukaj' }).click();
  await page.getByRole('combobox', { name: 'Szukaj w Suma' }).fill('Cash');
  await page.locator('[cmdk-item][data-value^="konto Cash"]').click();

  await expect(page).toHaveURL(/\/accounts\?account=.*&month=2026-05/);
  await expect(page.getByText('Historia — Cash')).toBeVisible();
});
