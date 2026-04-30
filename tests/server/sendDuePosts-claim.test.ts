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
	resetTestDatabase('send-due-posts-claim');
	seedCallbackTestData();
	// Use unlimited tier so concurrent runs are not capped by the 20/month free quota.
	getDatabase().prepare('UPDATE user SET tier = ? WHERE id = ?').run('admin', TEST_USER_ID);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function seedDuePost(id: string, scheduledAt: string) {
	const db = getDatabase();
	db.prepare(
		`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, content, image_url, scheduled_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', NULL, ?, 'scheduled', datetime('now'), datetime('now'))`
	).run(id, TEST_USER_ID, TEST_WEBHOOK_ID, `Post ${id}`, scheduledAt);
}

describe('sendDuePosts atomic claim', () => {
	it('two concurrent runs deliver each due post exactly once', async () => {
		const db = getDatabase();
		db.prepare("DELETE FROM post WHERE account_id = ?").run(TEST_USER_ID);

		const ids = Array.from({ length: 20 }, (_, i) => `claim-post-${i}`);
		for (const id of ids) seedDuePost(id, '2000-01-01T00:00:00');

		const fetchMock = vi.fn().mockImplementation(async () => ({
			ok: true,
			status: 200,
			statusText: 'OK',
			text: async () => '{}'
		}));
		vi.stubGlobal('fetch', fetchMock);

		const [a, b] = await Promise.all([sendDuePosts(), sendDuePosts()]);

		const totalSent = (a.sent ?? 0) + (b.sent ?? 0);
		expect(totalSent).toBe(ids.length);
		expect(fetchMock).toHaveBeenCalledTimes(ids.length);

		const statuses = db
			.prepare(`SELECT status, COUNT(*) AS n FROM post WHERE account_id = ? GROUP BY status`)
			.all(TEST_USER_ID) as { status: string; n: number }[];
		const map = Object.fromEntries(statuses.map((row) => [row.status, row.n]));
		expect(map.sent).toBe(ids.length);
		expect(map.sending).toBeUndefined();
		expect(map.scheduled).toBeUndefined();
	});

	it('claim flips status to sending before fetch is awaited', async () => {
		const db = getDatabase();
		db.prepare("DELETE FROM post WHERE account_id = ?").run(TEST_USER_ID);
		const id = 'claim-post-flip';
		seedDuePost(id, '2000-01-01T00:00:00');

		let observedStatus: string | null = null;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => {
				observedStatus = (
					db.prepare('SELECT status FROM post WHERE id = ?').get(id) as { status: string }
				).status;
				return { ok: true, status: 200, statusText: 'OK', text: async () => '{}' };
			})
		);

		await sendDuePosts();
		expect(observedStatus).toBe('sending');
	});
});
