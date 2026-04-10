/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sendDuePosts } from '$lib/scheduler/sendDuePosts.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID } from '../helpers/testDb.js';

beforeAll(() => {
	resetTestDatabase('send-due-posts-timezone');
	seedCallbackTestData();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendDuePosts timezone UTC behavior', () => {
	it('sends only posts due by UTC now', async () => {
		const db = getDatabase();
		const dueIso = new Date(Date.now() - 60_000).toISOString();
		const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
       VALUES ('tz-due', ?, ?, 'Due', ?, 'scheduled', datetime('now'), datetime('now'))`
		).run(TEST_USER_ID, TEST_WEBHOOK_ID, dueIso);
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
       VALUES ('tz-future', ?, ?, 'Future', ?, 'scheduled', datetime('now'), datetime('now'))`
		).run(TEST_USER_ID, TEST_WEBHOOK_ID, futureIso);

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => '{}'
			})
		);

		const result = await sendDuePosts();
		expect(result.sent).toBeGreaterThanOrEqual(1);
		const dueStatus = (db.prepare('SELECT status FROM post WHERE id = ?').get('tz-due') as { status: string }).status;
		const futureStatus = (db.prepare('SELECT status FROM post WHERE id = ?').get('tz-future') as { status: string }).status;
		expect(dueStatus).toBe('sent');
		expect(futureStatus).toBe('scheduled');
	});
});
