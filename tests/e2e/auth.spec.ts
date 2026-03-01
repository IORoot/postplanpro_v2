import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
	test('unauthenticated user is redirected to login', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('login page loads', async ({ page }) => {
		await page.goto('/auth/login');
		await expect(page).toHaveURL('/auth/login');
		await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
	});

	test('protected paths redirect to login', async ({ page }) => {
		for (const path of ['/posts', '/calendar', '/schedules', '/settings', '/bulk-create']) {
			await page.goto(path);
			await expect(page).toHaveURL(/\/auth\/login/);
		}
	});
});
