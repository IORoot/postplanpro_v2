import { test, expect } from '@playwright/test';

test.describe('Inputs', () => {
	test('inputs page requires auth', async ({ page }) => {
		await page.goto('/inputs');
		await expect(page).toHaveURL('/');
	});
});
