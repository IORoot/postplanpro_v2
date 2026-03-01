/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '../../src/routes/api/callbacks/import/+server';
import { getDatabase } from '$lib/db/index.js';
import {
	setTestDatabasePath,
	seedCallbackTestData,
	TEST_CALLBACK_TOKEN,
	TEST_WEBHOOK_ID
} from '../helpers/testDb.js';

beforeAll(() => {
	setTestDatabasePath();
	getDatabase(); // trigger DB creation and schema
	seedCallbackTestData();
});

describe('POST /api/callbacks/import', () => {
	it('returns 401 when no token', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ posts: [] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toMatch(/token/i);
	});

	it('returns 401 when token is invalid', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer invalid-token'
			},
			body: JSON.stringify({ posts: [] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toMatch(/Invalid callback token/i);
	});

	it('returns 400 for invalid JSON', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: 'not json'
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/JSON/i);
	});

	it('returns 400 when posts is not a non-empty array', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({ posts: [] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/non-empty.*posts/i);
	});

	it('returns 400 when post missing webhook_id/webhook_ids', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({
				posts: [{ title: 'A', content: 'B' }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/webhook_id|webhook_ids/i);
	});

	it('returns 400 when post has empty title', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({
				posts: [{ title: '  ', webhook_id: TEST_WEBHOOK_ID }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/title/i);
	});

	it('returns 200 and creates drafts with valid token and body', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({
				posts: [
					{ title: 'Imported Post', content: 'Body', webhook_id: TEST_WEBHOOK_ID }
				]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
		expect(data.imported).toBe(1);
		expect(Array.isArray(data.post_ids)).toBe(true);
		expect(data.post_ids).toHaveLength(1);
	});

	it('accepts X-Callback-Token header', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Callback-Token': TEST_CALLBACK_TOKEN
			},
			body: JSON.stringify({
				posts: [{ title: 'Via Header', webhook_id: TEST_WEBHOOK_ID }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
	});
});
