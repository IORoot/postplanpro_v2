/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getWebhookIdsForPost, setPostWebhooks } from '$lib/db/postWebhooks.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID } from '../helpers/testDb.js';

beforeAll(() => {
	resetTestDatabase('post-webhooks');
	seedCallbackTestData();
	const db = getDatabase();
	const w2 = 'second-webhook-id';
	db.prepare('INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
		w2,
		TEST_USER_ID,
		'W2',
		'https://example.com/w2'
	);
});

describe('postWebhooks', () => {
	it('getWebhookIdsForPost backfills from post.webhook_id when post_webhook empty', () => {
		const db = getDatabase();
		const pid = 'pw-post-1';
		db.prepare(
			'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
		).run(pid, TEST_USER_ID, TEST_WEBHOOK_ID, 'P', 'draft');
		db.prepare('DELETE FROM post_webhook WHERE post_id = ?').run(pid);
		const ids = getWebhookIdsForPost(db, pid, TEST_WEBHOOK_ID);
		expect(ids).toEqual([TEST_WEBHOOK_ID]);
	});

	it('getWebhookIdsForPost returns rows from post_webhook', () => {
		const db = getDatabase();
		const pid = 'pw-post-2';
		db.prepare(
			'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
		).run(pid, TEST_USER_ID, TEST_WEBHOOK_ID, 'P2', 'draft');
		setPostWebhooks(db, pid, TEST_USER_ID, [TEST_WEBHOOK_ID, 'second-webhook-id']);
		const ids = getWebhookIdsForPost(db, pid, TEST_WEBHOOK_ID);
		expect([...ids].sort()).toEqual([TEST_WEBHOOK_ID, 'second-webhook-id'].sort());
	});

	it('setPostWebhooks clears links and nulls post.webhook_id when list empty', () => {
		const db = getDatabase();
		const pid = 'pw-post-3';
		db.prepare(
			'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
		).run(pid, TEST_USER_ID, TEST_WEBHOOK_ID, 'P3', 'draft');
		setPostWebhooks(db, pid, TEST_USER_ID, [TEST_WEBHOOK_ID]);
		setPostWebhooks(db, pid, TEST_USER_ID, []);
		expect((db.prepare('SELECT COUNT(*) as n FROM post_webhook WHERE post_id = ?').get(pid) as { n: number }).n).toBe(0);
		expect(
			(db.prepare('SELECT webhook_id FROM post WHERE id = ?').get(pid) as { webhook_id: string | null }).webhook_id
		).toBeNull();
	});
});
