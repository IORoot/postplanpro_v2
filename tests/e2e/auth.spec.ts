import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
	test('unauthenticated user sees marketing home at /', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL('/');
	});

	test('home page has pricing section with all three plan tiers', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL('/');
		const pricing = page.locator('#pricing');
		await expect(pricing).toBeVisible();
		// Plan names appear as headings in the card-based pricing layout
		await expect(pricing.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
		await expect(pricing.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
		await expect(pricing.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
	});

	test('login page loads', async ({ page }) => {
		await page.goto('/auth/login');
		await expect(page).toHaveURL('/auth/login');
		await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
	});

	test('protected paths redirect to / when unauthenticated', async ({ page }) => {
		for (const path of ['/posts', '/calendar', '/schedules', '/settings', '/inputs', '/inputs/webhooks', '/outputs', '/reports', '/account']) {
			await page.goto(path);
			await expect(page).toHaveURL('/');
		}
	});

	test('admin path redirects when unauthenticated', async ({ page }) => {
		await page.goto('/users');
		await expect(page).toHaveURL('/');
	});
});

test.describe('Login UI', () => {
	test('wrong password shows sign-in error', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByLabel(/email/i).fill('e2e@postplan.test');
		await page.getByLabel(/^password$/i).fill('WrongPassword1!');
		await page.getByRole('button', { name: 'Sign in with email' }).click();
		await expect(page.getByText(/invalid email or password|not verified/i)).toBeVisible({ timeout: 15_000 });
	});

	test('OAuth section heading is visible', async ({ page }) => {
		await page.goto('/auth/login');
		await expect(page.getByRole('heading', { name: /social/i })).toBeVisible();
	});
});
