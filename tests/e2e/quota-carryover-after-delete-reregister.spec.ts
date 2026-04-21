/**
 * E2E: free user exhausts monthly output quota (20 sends), deletes account, same email signs up again
 * (simulated as DB re-seed with verified user — mirrors completed registration + email carryover).
 * Billing must show 20/20 and Send now must hit the quota wall without a 21st successful send.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { PLAYWRIGHT_E2E_DB } from './playwright-test-env.js';
import { seedVerifiedUserWithPassword } from '../helpers/testDb.js';

const REREG_EMAIL = 'quota-rereg-e2e@postplan.test';
const REREG_PASSWORD = 'ReregPassw0rd!';
const USER1_ID = 'e2e-quota-rereg-user-1';
const USER2_ID = 'e2e-quota-rereg-user-2';

async function signIn(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/auth/login');
	await expect(page).toHaveURL(/\/auth\/login/);
	await page.getByLabel(/email/i).fill(REREG_EMAIL);
	await page.getByLabel(/^password$/i).fill(REREG_PASSWORD);
	await page.getByRole('button', { name: 'Sign in with email' }).click();
	await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 25_000 });
	await expect(page.getByRole('heading', { name: /^Calendar$/i })).toBeVisible({ timeout: 10_000 });
}

async function removeReregUserAndCarryover(): Promise<void> {
	process.env.DATABASE_PATH = PLAYWRIGHT_E2E_DB;
	const { closeDatabaseForTesting, getDatabase } = await import('../../src/lib/db/index.js');
	closeDatabaseForTesting();
	const db = getDatabase();
	db.prepare('DELETE FROM email_quota_carryover_month WHERE email_norm = ?').run(REREG_EMAIL.trim().toLowerCase());
	db.prepare('DELETE FROM user WHERE email = ?').run(REREG_EMAIL);
	closeDatabaseForTesting();
}

test.describe('Quota carryover after delete and re-register', () => {
	test.describe.configure({ mode: 'serial' });

	test('20 sends, delete account, new account same email: billing 20/20 and send blocked', async ({ page }) => {
		test.setTimeout(240_000);

		await removeReregUserAndCarryover();

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

		process.env.DATABASE_PATH = PLAYWRIGHT_E2E_DB;
		const { closeDatabaseForTesting, getDatabase } = await import('../../src/lib/db/index.js');

		try {
			closeDatabaseForTesting();
			seedVerifiedUserWithPassword(USER1_ID, REREG_EMAIL, REREG_PASSWORD, 'free');
			const db = getDatabase();
			const wh1 = randomUUID();
			db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
				wh1,
				USER1_ID,
				'E2E rereg out',
				webhookUrl
			);
			const ins = db.prepare(
				`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
			);
			for (let i = 0; i < 21; i++) {
				ins.run(`e2e-rq-${i}`, USER1_ID, wh1, `Rereg ${i}`);
			}
			closeDatabaseForTesting();

			await signIn(page);

			for (let i = 0; i < 20; i++) {
				await page.goto(`/posts/e2e-rq-${i}`);
				await expect(page.getByRole('heading', { name: /^Edit post$/i })).toBeVisible({ timeout: 15_000 });
				await page.getByRole('button', { name: 'Send now' }).click();
				await expect(page.locator('span.status-sent')).toBeVisible({ timeout: 20_000 });
			}

			await page.goto('/posts/e2e-rq-20');
			await expect(page.getByRole('heading', { name: /^Edit post$/i })).toBeVisible({ timeout: 15_000 });
			await page.getByRole('button', { name: 'Send now' }).click();
			await expect(page.locator('p.alert-error')).toContainText(/Monthly output send limit reached/i, {
				timeout: 20_000
			});

			await page.goto('/account?section=account');
			await expect(page.getByRole('heading', { name: /Delete account/i })).toBeVisible({ timeout: 15_000 });
			await page.locator('#delete-confirm').fill('DELETE');
			await page.getByRole('button', { name: 'Delete my account' }).click();
			await expect(page).toHaveURL(/\/$/, { timeout: 25_000 });

			closeDatabaseForTesting();
			seedVerifiedUserWithPassword(USER2_ID, REREG_EMAIL, REREG_PASSWORD, 'free');
			const db2 = getDatabase();
			const wh2 = randomUUID();
			db2.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
				wh2,
				USER2_ID,
				'E2E rereg out',
				webhookUrl
			);
			db2.prepare(
				`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
         VALUES ('e2e-rq2-0', ?, ?, 'After rereg', 'draft', datetime('now'), datetime('now'))`
			).run(USER2_ID, wh2);
			closeDatabaseForTesting();

			await signIn(page);

			await page.goto('/account?section=billing');
			await expect(page.getByRole('heading', { name: /Plan & usage/i })).toBeVisible({ timeout: 15_000 });
			await expect(
				page.locator('section').filter({ has: page.getByRole('heading', { name: 'Plan & usage' }) }).getByText(/\b20\s*\/\s*20\b/)
			).toBeVisible();

			await page.goto('/posts/e2e-rq2-0');
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
			await removeReregUserAndCarryover();
		}
	});
});
