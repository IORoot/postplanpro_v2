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
	TEST_WEBHOOK_ID,
	TEST_USER_ID,
	insertScheduleWithSlots
} from '../helpers/testDb.js';
import { currentMonthKey, incrementUsageMonth } from '$lib/usage.js';
import { getDatabase } from '$lib/db/index.js';

beforeAll(() => {
	setTestDatabasePath('callbacks-import');
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
		expect(data.error).toBe('Operation failed.');
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

	it('returns 400 when a post entry is not an object', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({ posts: [[]] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 400 for invalid webhook id', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({ posts: [{ title: 'X', webhook_id: 'not-a-real-webhook' }] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('imports with schedule_specific datetime', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [
					{
						title: 'At time',
						webhook_id: TEST_WEBHOOK_ID,
						schedule_specific: '2041-03-15T14:00:00.000Z',
						content: { nested: true },
						colour: '#ff0000',
						fields: { meta: { x: 1 } }
					}
				]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(200);
		const row = getDatabase().prepare('SELECT status, content FROM post WHERE title = ?').get('At time') as {
			status: string;
			content: string;
		};
		expect(row.status).toBe('scheduled');
		expect(row.content).toContain('nested');
		const pf = getDatabase()
			.prepare(
				'SELECT key, type, value FROM post_field WHERE post_id = (SELECT id FROM post WHERE title = ? LIMIT 1) AND key = ?'
			)
			.get('At time', 'meta') as {
			key: string;
			type: string;
			value: string;
		};
		expect(pf.key).toBe('meta');
		expect(pf.type).toBe('json');
		expect(JSON.parse(pf.value).x).toBe(1);
	});

	it('imports with schedule_ids and dedupes external_id', async () => {
		const sid = 'import-cb-sched';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2042-01-01T09:00:00', '2042-01-02T09:00:00'], { name: 'Import Sched' });
		const body = {
			posts: [
				{
					title: 'Dup ext',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_ids: [sid],
					external_id: 'ext-1'
				}
			]
		};
		const r1 = await POST({
			request: new Request('http://test/api/callbacks/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
				body: JSON.stringify(body)
			})
		});
		expect(r1.status).toBe(200);
		const r2 = await POST({
			request: new Request('http://test/api/callbacks/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
				body: JSON.stringify(body)
			})
		});
		expect(r2.status).toBe(200);
		const d2 = (await r2.json()) as { imported: number };
		expect(d2.imported).toBe(0);
	});

	it('accepts schedule_ids as a single string id', async () => {
		const sid = 'import-str-sched';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2043-07-01T11:00:00'], { name: 'StrSched' });
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [{ title: 'String sched id', webhook_id: TEST_WEBHOOK_ID, schedule_ids: sid }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(200);
	});

	it('returns 400 when schedule has no available slots', async () => {
		const sid = 'import-empty-sched';
		getDatabase()
			.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, NULL)')
			.run(sid, TEST_USER_ID, 'Empty');
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [{ title: 'No slot', webhook_id: TEST_WEBHOOK_ID, schedule_ids: [sid] }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 400 for invalid schedule_id in schedule_ids', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [{ title: 'Bad sched', webhook_id: TEST_WEBHOOK_ID, schedule_ids: ['not-real-schedule'] }]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 400 for invalid schedule_specific datetime', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [
					{
						title: 'Bad dt',
						webhook_id: TEST_WEBHOOK_ID,
						schedule_specific: 'not-a-valid-date'
					}
				]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 400 when schedule_ids and schedule_specific both set', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({
				posts: [
					{
						title: 'Conflict',
						webhook_id: TEST_WEBHOOK_ID,
						schedule_ids: ['x'],
						schedule_specific: '2040-01-01T00:00:00.000Z'
					}
				]
			})
		});
		const response = await POST({ request });
		expect(response.status).toBe(400);
	});

	it('returns 403 when callback import usage would exceed tier limit', async () => {
		const db = getDatabase();
		const month = currentMonthKey();
		incrementUsageMonth(db, TEST_USER_ID, month, { callbackInputs: 100 });
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_CALLBACK_TOKEN}` },
			body: JSON.stringify({ posts: [{ title: 'Over', webhook_id: TEST_WEBHOOK_ID }] })
		});
		const response = await POST({ request });
		expect(response.status).toBe(403);
	});
});
