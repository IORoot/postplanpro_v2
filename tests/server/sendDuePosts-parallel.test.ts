/**
 * @vitest-environment node
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendDuePosts } from '$lib/scheduler/sendDuePosts.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID } from '../helpers/testDb.js';

vi.mock('$env/dynamic/private', () => ({
	env: { APP_BASE_URL: 'https://production.example.com' }
}));

beforeAll(() => {
	resetTestDatabase('send-due-posts-parallel');
	seedCallbackTestData();
	// Use unlimited tier so the 20/month free cap doesn't gate this throughput test.
	getDatabase().prepare('UPDATE user SET tier = ? WHERE id = ?').run('admin', TEST_USER_ID);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendDuePosts parallel workers', () => {
	it('completes 50 posts faster than serial via bounded concurrency', async () => {
		const db = getDatabase();
		db.prepare("DELETE FROM post WHERE account_id = ?").run(TEST_USER_ID);

		const total = 50;
		for (let i = 0; i < total; i++) {
			db.prepare(
				`INSERT INTO post (id, account_id, webhook_id, title, content, image_url, scheduled_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', NULL, '2000-01-01T00:00:00', 'scheduled', datetime('now'), datetime('now'))`
			).run(`parallel-post-${i}`, TEST_USER_ID, TEST_WEBHOOK_ID, `Post ${i}`);
		}

		const FETCH_DELAY_MS = 40;
		const fetchMock = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								text: async () => '{}'
							}),
						FETCH_DELAY_MS
					)
				)
		);
		vi.stubGlobal('fetch', fetchMock);

		// Force a known concurrency for deterministic timing assertion.
		const prevConcurrency = process.env.SENDER_CONCURRENCY;
		process.env.SENDER_CONCURRENCY = '50';
		const t0 = Date.now();
		const result = await sendDuePosts();
		const elapsedMs = Date.now() - t0;
		process.env.SENDER_CONCURRENCY = prevConcurrency;

		expect(result.sent).toBe(total);
		expect(fetchMock).toHaveBeenCalledTimes(total);
		const serialMs = total * FETCH_DELAY_MS;
		expect(elapsedMs).toBeLessThan(serialMs / 2);

		const remaining = (
			db.prepare(`SELECT COUNT(*) AS n FROM post WHERE account_id = ? AND status != 'sent'`).get(
				TEST_USER_ID
			) as { n: number }
		).n;
		expect(remaining).toBe(0);
	});
});
