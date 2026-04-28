import { expect, test } from '@playwright/test';

test('renders the login screen', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible();
  await expect(page.getByPlaceholder('jan@kowalski.pl')).toBeVisible();
});
