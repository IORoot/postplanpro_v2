import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { PLAYWRIGHT_E2E_DB, E2E_USER_EMAIL, E2E_USER_PASSWORD } from './playwright-test-env.js';

const E2E_USER_ID = 'e2e-playwright-user';

async function signInWithSeededUser(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/auth/login');
	await expect(page).toHaveURL(/\/auth\/login/);
	await page.getByLabel(/email/i).fill(E2E_USER_EMAIL);
	await page.getByLabel(/^password$/i).fill(E2E_USER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in with email' }).click();
	await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 25_000 });
	await expect(page.getByRole('heading', { name: /^Calendar$/i })).toBeVisible({ timeout: 10_000 });
}

test.describe('Free tier monthly output cap (Playwright)', () => {
	test.describe.configure({ mode: 'serial' });

	test('21st Send now is blocked after 20 successful sends', async ({ page }) => {
		test.setTimeout(180_000);

		process.env.DATABASE_PATH = PLAYWRIGHT_E2E_DB;
		const { closeDatabaseForTesting, getDatabase } = await import('../../src/lib/db/index.js');

		const server = http.createServer((_req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end('{}');
		});
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => resolve());
		});
		const { port } = server.address() as AddressInfo;
		const webhookUrl = `http://127.0.0.1:${port}/hook`;

		let previousWebhookUrl = 'https://example.com/e2e-webhook';

		try {
			closeDatabaseForTesting();
			const db = getDatabase();
			const wh = db
				.prepare('SELECT id, url FROM webhook_config WHERE account_id = ? LIMIT 1')
				.get(E2E_USER_ID) as { id: string; url: string } | undefined;
			if (!wh) {
				throw new Error('Seeded E2E user is missing webhook_config (global-setup)');
			}
			previousWebhookUrl = wh.url;

			db.prepare('DELETE FROM send_log WHERE account_id = ?').run(E2E_USER_ID);
			db.prepare(`DELETE FROM post WHERE account_id = ? AND id LIKE 'e2e-quota-%'`).run(E2E_USER_ID);

			const ins = db.prepare(
				`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
			);
			for (let i = 0; i < 21; i++) {
				ins.run(`e2e-quota-${i}`, E2E_USER_ID, wh.id, `E2E quota ${i}`);
			}
			db.prepare('UPDATE webhook_config SET url = ? WHERE id = ?').run(webhookUrl, wh.id);
			closeDatabaseForTesting();

			await signInWithSeededUser(page);

			for (let i = 0; i < 20; i++) {
				await page.goto(`/posts/e2e-quota-${i}`);
				await expect(page.getByRole('heading', { name: /^Edit post$/i })).toBeVisible({ timeout: 15_000 });
				await page.getByRole('button', { name: 'Send now' }).click();
				await expect(page.locator('span.status-sent')).toBeVisible({ timeout: 20_000 });
			}

			await page.goto('/posts/e2e-quota-20');
			await expect(page.getByRole('heading', { name: /^Edit post$/i })).toBeVisible({ timeout: 15_000 });
			await page.getByRole('button', { name: 'Send now' }).click();
			await expect(page.locator('p.alert-error')).toContainText(/Monthly output send limit reached/i, {
				timeout: 20_000
			});
			await expect(page.locator('span.status-draft')).toBeVisible();
		} finally {
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			});
			closeDatabaseForTesting();
			const db = getDatabase();
			db.prepare('UPDATE webhook_config SET url = ? WHERE account_id = ?').run(previousWebhookUrl, E2E_USER_ID);
			db.prepare('DELETE FROM send_log WHERE account_id = ?').run(E2E_USER_ID);
			db.prepare(`DELETE FROM post WHERE account_id = ? AND id LIKE 'e2e-quota-%'`).run(E2E_USER_ID);
			closeDatabaseForTesting();
		}
	});
});
