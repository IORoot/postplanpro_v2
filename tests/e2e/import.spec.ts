import { test, expect } from '@playwright/test';

test.describe('Import (bulk-create)', () => {
	test('bulk-create page requires auth', async ({ page }) => {
		await page.goto('/bulk-create');
		await expect(page).toHaveURL(/\/welcome/);
	});
});
