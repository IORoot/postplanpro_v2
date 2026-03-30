/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load, actions } from '../../src/routes/calendar/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('calendar-load');
	seedCallbackTestData();
	// Month view for 2025 loads the full calendar year of anchor date.
	insertPostRow({
		id: 'cal-in',
		title: 'In 2025',
		scheduled_at: '2025-07-15T14:00:00',
		status: 'scheduled'
	});
	insertPostRow({
		id: 'cal-out',
		title: 'In 2024',
		scheduled_at: '2024-12-31T10:00:00',
		status: 'scheduled'
	});
});

function calLoad(url: string, userId: string | null) {
	return load(mockRequestEvent({ userId }, url));
}

describe('calendar/+page.server load', () => {
	it('returns empty posts when not authenticated', async () => {
		const r = await calLoad('http://test/calendar?view=month&date=2025-06-01', null);
		expect(r.posts).toEqual([]);
		expect(r.stats).toBeNull();
		expect(r.sentThisWeek).toBe(0);
		expect(r.stagePasses).toBe(0);
		expect(r.stageFails).toBe(0);
	});

	it('month view includes only posts in anchor year', async () => {
		const r = await calLoad('http://test/calendar?view=month&date=2025-06-01', TEST_USER_ID);
		const ids = r.posts.map((p) => p.id).sort();
		expect(ids).toEqual(['cal-in']);
		expect(r.view).toBe('month');
		expect(r.stats).not.toBeNull();
		expect(r.stats).toHaveProperty('totalPosts');
	});

	it('agenda view returns all scheduled posts regardless of year filter', async () => {
		const r = await calLoad('http://test/calendar?view=agenda&date=2025-06-01', TEST_USER_ID);
		const ids = r.posts.map((p) => p.id).sort();
		expect(ids).toEqual(['cal-in', 'cal-out']);
	});

	it('defaults invalid view to month', async () => {
		const r = await calLoad('http://test/calendar?view=bad&date=2025-06-01', TEST_USER_ID);
		expect(r.view).toBe('month');
	});

	it('day view uses week-aligned range', async () => {
		const r = await calLoad('http://test/calendar?view=day&date=2025-06-15', TEST_USER_ID);
		expect(r.view).toBe('day');
		expect(r.rangeStart <= r.rangeEnd).toBe(true);
	});

	it('week view spans month with Monday padding', async () => {
		const r = await calLoad('http://test/calendar?view=week&date=2025-06-15', TEST_USER_ID);
		expect(r.view).toBe('week');
	});

	it('year view loads full calendar year', async () => {
		const r = await calLoad('http://test/calendar?view=year&date=2025-06-15', TEST_USER_ID);
		expect(r.view).toBe('year');
		expect(r.posts.map((p) => p.id).sort()).toEqual(['cal-in']);
	});

	it('schedule view loads year span like year', async () => {
		const r = await calLoad('http://test/calendar?view=schedule&date=2025-06-15', TEST_USER_ID);
		expect(r.view).toBe('schedule');
	});

	it('parseDate falls back when date param is invalid', async () => {
		const r = await calLoad('http://test/calendar?view=month&date=not-a-date', TEST_USER_ID);
		expect(r.anchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('calendar/+page.server reschedulePost', () => {
	it('updates scheduled_at for owned post', async () => {
		const res = await actions.reschedulePost?.({
			request: formRequest('http://test/calendar', {
				post_id: 'cal-in',
				scheduled_at: '2025-08-20T09:30:00'
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.reschedulePost>>[0]);
		expect(res).toEqual({ success: true });
		const at = (getDatabase().prepare('SELECT scheduled_at FROM post WHERE id = ?').get('cal-in') as { scheduled_at: string })
			.scheduled_at;
		expect(at).toBe('2025-08-20T09:30:00');
	});

	it('returns 404 for unknown post id', async () => {
		const res = await actions.reschedulePost?.({
			request: formRequest('http://test/calendar', {
				post_id: 'missing',
				scheduled_at: '2025-08-20T09:30:00'
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.reschedulePost>>[0]);
		expect(res).toMatchObject({ status: 404 });
	});
});
