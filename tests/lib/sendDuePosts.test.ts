/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sendDuePosts, sendPost } from '$lib/scheduler/sendDuePosts.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID } from '../helpers/testDb.js';

vi.mock('$env/dynamic/private', () => ({
	env: {
		APP_BASE_URL: 'https://production.example.com'
	}
}));

beforeAll(() => {
	resetTestDatabase('send-due-posts');
	seedCallbackTestData();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendDuePosts', () => {
	it('marks post sent when webhook returns ok', async () => {
		const db = getDatabase();
		const postId = 'due-post-ok';
		const past = '2000-01-01T00:00:00';
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, content, image_url, scheduled_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', NULL, ?, 'scheduled', datetime('now'), datetime('now'))`
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Due', past);

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => '{"ok":true}'
			})
		);

		const r = await sendDuePosts();
		expect(r.sent).toBeGreaterThanOrEqual(1);
		expect(r.errors.filter((e) => e.includes(postId))).toHaveLength(0);
		const st = (db.prepare('SELECT status FROM post WHERE id = ?').get(postId) as { status: string }).status;
		expect(st).toBe('sent');
	});

	it('fails when webhook HTTP response is not ok', async () => {
		const db = getDatabase();
		const postId = 'due-http-fail';
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '2000-02-01T00:00:00', 'scheduled', datetime('now'), datetime('now'))`
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'X');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				statusText: 'Bad',
				text: async () => 'upstream error'
			})
		);
		const r = await sendDuePosts();
		expect(r.failed).toBeGreaterThanOrEqual(1);
		const st = (db.prepare('SELECT status FROM post WHERE id = ?').get(postId) as { status: string }).status;
		expect(st).toBe('failed');
	});

	it('records failure when fetch throws', async () => {
		const db = getDatabase();
		const postId = 'due-fetch-throw';
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '2000-04-01T00:00:00', 'scheduled', datetime('now'), datetime('now'))`
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Net');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
		const r = await sendDuePosts();
		expect(r.failed).toBeGreaterThanOrEqual(1);
		expect(r.errors.some((e) => e.includes('network down'))).toBe(true);
	});

	it('fails on invalid payload_override JSON', async () => {
		const db = getDatabase();
		const postId = 'due-bad-payload';
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, payload_override, created_at, updated_at)
       VALUES (?, ?, ?, ?, '2000-03-01T00:00:00', 'scheduled', '{not json', datetime('now'), datetime('now'))`
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Bad');
		const r = await sendDuePosts();
		expect(r.failed).toBeGreaterThanOrEqual(1);
		expect(r.errors.some((e) => e.includes('invalid JSON'))).toBe(true);
	});
});

describe('sendPost', () => {
	it('returns not found for wrong id', async () => {
		const r = await sendPost('missing-id', TEST_USER_ID);
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error).toBe('Post not found');
	});

	it('succeeds when webhook returns ok', async () => {
		const db = getDatabase();
		const postId = 'send-one-ok';
		db.prepare(
			`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Z');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => '{}'
			})
		);
		const r = await sendPost(postId, TEST_USER_ID);
		expect(r.success).toBe(true);
		if (r.success) expect(r.responseStatus).toBe(200);
		const st = (db.prepare('SELECT status FROM post WHERE id = ?').get(postId) as { status: string }).status;
		expect(st).toBe('sent');
	});
});
