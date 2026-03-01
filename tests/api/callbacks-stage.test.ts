/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '../../src/routes/api/callbacks/stage/+server';
import { getDatabase } from '$lib/db/index.js';
import {
	setTestDatabasePath,
	seedCallbackTestData,
	seedPostForStage,
	TEST_CALLBACK_TOKEN,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	TEST_POST_ID
} from '../helpers/testDb.js';

beforeAll(() => {
	setTestDatabasePath();
	getDatabase();
	seedCallbackTestData();
	seedPostForStage();
});

describe('POST /api/callbacks/stage', () => {
	it('returns 401 when no token', async () => {
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ post_id: TEST_POST_ID, stage_passed: 'done' })
		});
		const response = await POST({ request });
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toMatch(/token/i);
	});

	it('returns 401 when token is invalid', async () => {
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer bad-token'
			},
			body: JSON.stringify({ post_id: TEST_POST_ID, stage_passed: 'done' })
		});
		const response = await POST({ request });
		expect(response.status).toBe(401);
	});

	it('returns 400 for invalid JSON', async () => {
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: 'not json'
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 400 when missing post_id or stage fields', async () => {
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 404 when post not found', async () => {
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({ post_id: '00000000-0000-0000-0000-000000000000', stage_passed: 'done' })
		});
		const response = await POST({ request });
		expect(response.status).toBe(404);
	});

	it('returns 200 and records stage_passed', async () => {
		// Insert post in test so it exists in same DB connection (avoids cross-worker races)
		const postId = crypto.randomUUID();
		const db = getDatabase();
		db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
		).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Stage Test Post', 'draft');
		const request = new Request('http://test/api/callbacks/stage', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({ post_id: postId, stage_passed: 'review' })
		});
		const response = await POST({ request });
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
	});
});
