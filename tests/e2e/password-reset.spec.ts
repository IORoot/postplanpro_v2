import { test, expect } from '@playwright/test';
import {
	PLAYWRIGHT_E2E_DB,
	E2E_RESET_USER_EMAIL,
	E2E_RESET_USER_ID,
	E2E_RESET_NEW_PASSWORD
} from './playwright-test-env.js';
import { issueRawPasswordResetToken } from './password-reset-token.js';

test.describe.configure({ mode: 'serial' });

test.describe('Password reset', () => {
	test('reset page without token shows guidance', async ({ page }) => {
		const res = await page.goto('/auth/reset-password');
		expect(res?.ok()).toBeTruthy();
		await expect(page.getByText(/Missing reset token/i)).toBeVisible();
	});

	test('URL with only form action query shows hint', async ({ page }) => {
		const res = await page.goto('/auth/reset-password?/reset');
		expect(res?.ok()).toBeTruthy();
		await expect(page.getByText(/form action/i)).toBeVisible();
	});

	test('valid token: set new password, redirect to login, then sign in', async ({ page }) => {
		const raw = issueRawPasswordResetToken(PLAYWRIGHT_E2E_DB, E2E_RESET_USER_ID);
		const res = await page.goto(`/auth/reset-password?token=${encodeURIComponent(raw)}`);
		expect(res?.ok()).toBeTruthy();
		await expect(page.getByLabel(/new password/i)).toBeVisible();
		await page.getByLabel(/new password/i).fill(E2E_RESET_NEW_PASSWORD);
		await page.getByLabel(/confirm password/i).fill(E2E_RESET_NEW_PASSWORD);
		await page.getByRole('button', { name: /update password/i }).click();
		await expect(page).toHaveURL(/\/auth\/login\?passwordReset=1/);
		await page.getByLabel(/email/i).fill(E2E_RESET_USER_EMAIL);
		await page.getByLabel(/^password$/i).fill(E2E_RESET_NEW_PASSWORD);
		await page.getByRole('button', { name: 'Sign in with email' }).click();
		await expect(page.getByRole('heading', { name: /^Calendar$/i })).toBeVisible({ timeout: 20_000 });
	});
});
