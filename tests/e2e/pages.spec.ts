import { test, expect } from '@playwright/test';

test.describe('Pages (authenticated)', () => {
	test.beforeEach(async ({ page }) => {
		// Visit login and verify we're on login (no auth yet)
		await page.goto('/auth/login');
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('login page shows email and password inputs', async ({ page }) => {
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
	});

	test('login page has sign-in form', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
	});
});
