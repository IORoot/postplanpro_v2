/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load, actions } from '../../src/routes/posts/new/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	insertScheduleWithSlots,
	insertScheduleRule
} from '../helpers/testDb.js';
import { formRequest, mockRequestEvent } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('posts-new-schedule');
	seedCallbackTestData();
});

describe('posts/new load', () => {
	it('returns grouped templates with fields for authenticated user', async () => {
		const r = await load(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/posts/new') as Parameters<typeof load>[0]);
		expect(r.webhooks.length).toBeGreaterThanOrEqual(1);
		expect(r.schedules.length).toBeGreaterThanOrEqual(0);
		const instagram = r.templates.find((t) => t.name === 'Instagram');
		expect(instagram?.fields.length).toBeGreaterThanOrEqual(1);
	});

	it('returns empty lists when logged out', async () => {
		const r = await load(mockRequestEvent({ userId: null }, 'http://test/posts/new') as Parameters<typeof load>[0]);
		expect(r).toEqual({ webhooks: [], schedules: [], templates: [] });
	});
});

describe('posts/new create with schedule', () => {
	it('creates draft with manual datetime scheduling', async () => {
		try {
			await actions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'Datetime post',
					schedule_by: 'datetime',
					scheduled_at: '2039-06-01T15:00:00',
					webhook_ids: [TEST_WEBHOOK_ID]
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		const row = getDatabase().prepare('SELECT status, scheduled_at FROM post WHERE title = ?').get('Datetime post') as {
			status: string;
			scheduled_at: string;
		};
		expect(row.status).toBe('scheduled');
		// Europe/London is UTC+1 in June, so 15:00 local is stored as 14:00 UTC.
		expect(row.scheduled_at.slice(0, 16)).toBe('2039-06-01T14:00');
	});

	it('persists custom post fields on create', async () => {
		try {
			await actions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'With fields',
					webhook_ids: [TEST_WEBHOOK_ID],
					field_key_0: 'utm.source',
					field_type_0: 'string',
					field_value_0: 'newsletter'
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		const pid = (getDatabase().prepare('SELECT id FROM post WHERE title = ?').get('With fields') as { id: string }).id;
		const f = getDatabase().prepare('SELECT key, value FROM post_field WHERE post_id = ?').get(pid) as {
			key: string;
			value: string;
		};
		expect(f).toEqual({ key: 'utm.source', value: 'newsletter' });
	});

	it('schedules via schedule_id and schedule_by schedule', async () => {
		const sid = 'new-post-sched';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2036-01-01T12:00:00', '2036-01-02T12:00:00'], { name: 'For New', color: '#abc123' });
		try {
			await actions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'Scheduled new',
					content: '',
					schedule_by: 'schedule',
					schedule_id: sid,
					webhook_ids: [TEST_WEBHOOK_ID]
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		const row = getDatabase().prepare('SELECT scheduled_at, schedule_id, status, color FROM post WHERE title = ?').get('Scheduled new') as {
			scheduled_at: string;
			schedule_id: string;
			status: string;
			color: string | null;
		};
		expect(row.status).toBe('scheduled');
		expect(row.schedule_id).toBe(sid);
		expect(row.color).toBe('#abc123');
		expect(row.scheduled_at.slice(0, 10)).toBe('2036-01-01');
	});

	it('uses getNextFreeSlot when schedule has only rules', async () => {
		const sid = 'new-post-rule-slot';
		getDatabase()
			.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, NULL)')
			.run(sid, TEST_USER_ID, 'Rule only');
		getDatabase().prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(sid);
		insertScheduleRule(sid, 'daily', { time: '07:15' }, 0);
		try {
			await actions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'Rule slot post',
					schedule_by: 'schedule',
					schedule_id: sid,
					webhook_ids: [TEST_WEBHOOK_ID]
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		const st = (getDatabase().prepare('SELECT status, scheduled_at FROM post WHERE title = ?').get('Rule slot post') as {
			status: string;
			scheduled_at: string;
		}).status;
		expect(st).toBe('scheduled');
	});
});
