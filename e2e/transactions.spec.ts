import { expect, test } from '@playwright/test';

test('opens transaction details from the transactions list', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('jan@kowalski.pl').fill('root@root.com');
  await page.locator('input[name="password"]').fill('root1234!');
  await page.getByRole('button', { name: /Zaloguj/ }).click();

  await page.waitForURL('**/');
  await page.goto('/transactions');

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await firstRow.click();

  await expect(page.getByText('Konto').nth(1)).toBeVisible({ timeout: 2_000 });
});

test('supports selecting transactions for bulk work', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('jan@kowalski.pl').fill('root@root.com');
  await page.locator('input[name="password"]').fill('root1234!');
  await page.getByRole('button', { name: /Zaloguj/ }).click();

  await page.waitForURL('**/');
  await page.goto('/transactions');

  await page.getByLabel(/Zaznacz transakcję/).first().check();
  await expect(page.getByText('1 zazn.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usuń' })).toBeVisible();

  await page.getByRole('button', { name: 'Wyczyść' }).click();
  await expect(page.getByText('1 zazn.')).toBeHidden();
});

test('opens the transaction edit form from details', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('jan@kowalski.pl').fill('root@root.com');
  await page.locator('input[name="password"]').fill('root1234!');
  await page.getByRole('button', { name: /Zaloguj/ }).click();

  await page.waitForURL('**/');
  await page.goto('/transactions');

  await page.locator('tbody tr').first().click();
  await page.getByRole('button', { name: 'Edytuj transakcję' }).click();

  await expect(page.getByLabel('Kwota transakcji')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz zmiany' })).toBeVisible();
});
