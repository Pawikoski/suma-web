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

  await expect(page).toHaveURL(/\/budget$/);
  await expect(page.getByText('Budżet ogólny')).toBeVisible();
});
