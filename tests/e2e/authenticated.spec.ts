import { test, expect } from '@playwright/test';
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from './playwright-test-env.js';

async function signInWithEmail(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/auth/login');
	await expect(page).toHaveURL(/\/auth\/login/);
	await page.getByLabel(/email/i).fill(E2E_USER_EMAIL);
	await page.getByLabel(/^password$/i).fill(E2E_USER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in with email' }).click();
	// Auth.js may redirect to `/` then server redirects to `/calendar`; `options.redirectTo` is not always honored for credentials.
	await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 25_000 });
	await expect(page.getByRole('heading', { name: /^Calendar$/i })).toBeVisible({ timeout: 10_000 });
}

test.describe('Authenticated (seeded E2E user)', () => {
	test('email/password sign-in reaches calendar', async ({ page }) => {
		await signInWithEmail(page);
		await expect(page.getByRole('heading', { name: /^Calendar$/i })).toBeVisible();
	});

	test('posts list loads with heading', async ({ page }) => {
		await signInWithEmail(page);
		await page.goto('/posts');
		await expect(page).toHaveURL(/\/posts/);
		await expect(page.getByRole('heading', { name: 'Posts', exact: true })).toBeVisible();
	});

	test('inputs page is reachable when logged in', async ({ page }) => {
		await signInWithEmail(page);
		await page.goto('/inputs');
		await expect(page).toHaveURL(/\/inputs/);
		await expect(page.getByRole('heading', { name: /^Inputs$/i })).toBeVisible();
	});

	test('reports page loads', async ({ page }) => {
		await signInWithEmail(page);
		await page.goto('/reports');
		await expect(page).toHaveURL(/\/reports/);
		await expect(page.getByRole('heading', { name: /request|response|callback stages/i })).toBeVisible();
	});
});
