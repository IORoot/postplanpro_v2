/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load, actions } from '../../src/routes/posts/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	seedOtherUserWithWebhook,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	OTHER_USER_ID,
	OTHER_WEBHOOK_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';
import { insertScheduleWithSlots } from '../helpers/testDb.js';

beforeAll(() => {
	resetTestDatabase('posts-actions');
	seedCallbackTestData();
	seedOtherUserWithWebhook();
	const scheduleId = 'sched-a';
	// Slots must be >= `new Date()` inside getNextFreeSlot (product behavior).
	insertScheduleWithSlots(scheduleId, TEST_USER_ID, ['2030-06-01T12:00:00', '2030-06-02T12:00:00']);
	insertPostRow({
		id: 'p-draft',
		title: 'Draft A',
		status: 'draft',
		scheduled_at: null
	});
	insertPostRow({
		id: 'p-sent',
		title: 'Sent A',
		status: 'sent',
		scheduled_at: '2025-03-01T10:00:00'
	});
	insertPostRow({
		id: 'p-other',
		accountId: OTHER_USER_ID,
		webhookId: OTHER_WEBHOOK_ID,
		title: 'Other user post',
		status: 'draft'
	});
});

function loadPosts(url: string, userId: string | null) {
	return load(mockRequestEvent({ userId }, url));
}

describe('posts/+page.server load', () => {
	it('returns only posts for account and joins webhook name', async () => {
		const r = await loadPosts('http://test/posts', TEST_USER_ID);
		const titles = r.posts.map((p) => p.title).sort();
		expect(titles).toEqual(['Draft A', 'Sent A']);
		expect(r.posts.every((p) => p.webhook_name === 'Test Webhook')).toBe(true);
	});

	it('filters by status=draft', async () => {
		const r = await loadPosts('http://test/posts?status=draft', TEST_USER_ID);
		expect(r.posts.map((p) => p.id).sort()).toEqual(['p-draft']);
	});

	it('ignores invalid status param', async () => {
		const r = await loadPosts('http://test/posts?status=nope', TEST_USER_ID);
		expect(r.posts.length).toBe(2);
	});

	it('filters scheduled=yes', async () => {
		const r = await loadPosts('http://test/posts?scheduled=yes', TEST_USER_ID);
		expect(r.posts.map((p) => p.id)).toEqual(['p-sent']);
	});

	it('filters scheduled=no', async () => {
		const r = await loadPosts('http://test/posts?scheduled=no', TEST_USER_ID);
		expect(r.posts.map((p) => p.id)).toEqual(['p-draft']);
	});

	it('filters by webhook id', async () => {
		const r = await loadPosts(`http://test/posts?webhook=${TEST_WEBHOOK_ID}`, TEST_USER_ID);
		expect(r.posts.length).toBe(2);
	});
});

describe('posts/+page.server actions', () => {
	it('deletePost removes only owned post', async () => {
		insertPostRow({ id: 'p-del', title: 'To delete' });
		const res = await actions.deletePost?.({
			request: formRequest('http://test/posts', { id: 'p-del' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deletePost>>[0]);
		expect(res).toEqual({ success: true });
		const row = getDatabase().prepare('SELECT id FROM post WHERE id = ?').get('p-del');
		expect(row).toBeUndefined();
	});

	it('bulkDelete removes selected owned posts only', async () => {
		insertPostRow({ id: 'b1', title: 'B1' });
		insertPostRow({ id: 'b2', title: 'B2' });
		const res = await actions.bulkDelete?.({
			request: formRequest('http://test/posts', { ids: ['b1', 'b2'] }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.bulkDelete>>[0]);
		expect(res).toMatchObject({ success: true, bulkDeleted: 2 });
		expect(getDatabase().prepare('SELECT id FROM post WHERE id IN (?,?)').all('b1', 'b2')).toEqual([]);
	});

	it('bulkDelete fails without ids', async () => {
		const res = await actions.bulkDelete?.({
			request: formRequest('http://test/posts', {}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.bulkDelete>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('bulkUpdateWebhook sets primary webhook for selected posts', async () => {
		const w2 = 'second-wh';
		getDatabase()
			.prepare('INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)')
			.run(w2, TEST_USER_ID, 'Second', 'https://s.example/h');
		insertPostRow({ id: 'bw1', title: 'W1', webhookId: TEST_WEBHOOK_ID });
		const res = await actions.bulkUpdateWebhook?.({
			request: formRequest('http://test/posts', { ids: ['bw1'], webhook_id: w2 }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.bulkUpdateWebhook>>[0]);
		expect(res).toMatchObject({ success: true });
		const wid = (
			getDatabase().prepare('SELECT webhook_id FROM post WHERE id = ?').get('bw1') as { webhook_id: string }
		).webhook_id;
		expect(wid).toBe(w2);
	});

	it('bulkUpdateWebhook fails for invalid webhook', async () => {
		insertPostRow({ id: 'bx', title: 'X' });
		const res = await actions.bulkUpdateWebhook?.({
			request: formRequest('http://test/posts', { ids: ['bx'], webhook_id: 'nonexistent' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.bulkUpdateWebhook>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('bulkUpdateSchedule assigns next slot when schedule has slots', async () => {
		insertPostRow({ id: 'bs1', title: 'S1', scheduled_at: null, status: 'draft' });
		const res = await actions.bulkUpdateSchedule?.({
			request: formRequest('http://test/posts', { ids: ['bs1'], schedule_id: 'sched-a' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.bulkUpdateSchedule>>[0]);
		expect(res).toMatchObject({ success: true });
		const row = getDatabase().prepare('SELECT schedule_id, status, scheduled_at FROM post WHERE id = ?').get('bs1') as {
			schedule_id: string;
			status: string;
			scheduled_at: string | null;
		};
		expect(row.schedule_id).toBe('sched-a');
		expect(row.status).toBe('scheduled');
		expect(row.scheduled_at).toMatch(/^2030-06-0[12]T\d{2}:00:00$/);
	});
});
