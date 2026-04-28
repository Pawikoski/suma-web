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
