/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load as schedulesIndexLoad, actions as schedulesIndexActions } from '../../src/routes/schedules/+page.server.js';
import { actions as schedulesNewActions } from '../../src/routes/schedules/new/+page.server.js';
import { load as scheduleDetailLoad, actions as scheduleDetailActions } from '../../src/routes/schedules/[id]/+page.server.js';
import { load as reportsLoad, actions as reportsActions } from '../../src/routes/reports/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	seedOtherUserWithWebhook,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	OTHER_USER_ID,
	OTHER_WEBHOOK_ID,
	insertPostRow,
	insertSendLog,
	insertPostStage,
	insertScheduleWithSlots,
	insertScheduleRule
} from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

function expectRedirect(e: unknown, status: number, locationSubstring: string) {
	expect(e).toMatchObject({ status, location: expect.stringContaining(locationSubstring) });
}

beforeAll(() => {
	resetTestDatabase('schedules-reports');
	seedCallbackTestData();
	insertPostRow({
		id: 'rep-post',
		title: 'Report Post',
		status: 'sent',
		scheduled_at: '2030-01-01T10:00:00'
	});
	insertSendLog({
		id: 'log-1',
		accountId: TEST_USER_ID,
		postId: 'rep-post',
		sent_at: '2030-01-02T12:00:00',
		request_json: '{"x":1}',
		success: 1
	});
	insertPostStage('rep-post', 'review', 'pass', '2030-01-03T10:00:00');
});

describe('schedules/+page.server', () => {
	it('load returns empty when not authenticated', async () => {
		const r = await schedulesIndexLoad(mockRequestEvent({ userId: null }, 'http://test/schedules'));
		expect(r.schedules).toEqual([]);
	});

	it('load lists schedules with slot and rule counts', async () => {
		const sid = 'sched-list-1';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2030-02-01T10:00:00'], { name: 'Alpha' });
		insertScheduleRule(sid, 'daily', { time: '09:00' }, 0);
		const r = await schedulesIndexLoad(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/schedules'));
		const row = r.schedules.find((s) => s.id === sid);
		expect(row?.name).toBe('Alpha');
		expect(row?.slot_count).toBe(1);
		expect(row?.rule_count).toBe(1);
	});

	it('deleteSchedule returns 401 without user', async () => {
		const res = await schedulesIndexActions.deleteSchedule?.({
			request: formRequest('http://test/schedules', { id: 'x' }),
			locals: { userId: null },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof schedulesIndexActions.deleteSchedule>>[0]);
		expect(res).toMatchObject({ status: 401 });
	});

	it('deleteSchedule returns 400 without id', async () => {
		const res = await schedulesIndexActions.deleteSchedule?.({
			request: formRequest('http://test/schedules', {}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof schedulesIndexActions.deleteSchedule>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('deleteSchedule removes only owned schedule', async () => {
		const sid = 'sched-del';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2030-03-01T10:00:00']);
		const res = await schedulesIndexActions.deleteSchedule?.({
			request: formRequest('http://test/schedules', { id: sid }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof schedulesIndexActions.deleteSchedule>>[0]);
		expect(res).toEqual({ success: true });
		expect(getDatabase().prepare('SELECT id FROM schedule WHERE id = ?').get(sid)).toBeUndefined();
	});
});

describe('schedules/new/+page.server create', () => {
	it('creates schedule with legacy slots and schedule_field', async () => {
		try {
			await schedulesNewActions.create?.({
				request: formRequest('http://test/schedules/new', {
					name: 'From Test',
					description: 'd',
					color: '#ff0000',
					slot_0: '2030-04-01T15:00:00',
					field_key_0: 'campaign.id',
					field_type_0: 'string',
					field_value_0: '42'
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof schedulesNewActions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expectRedirect(e, 303, '/schedules');
		}
		const row = getDatabase().prepare('SELECT id, name FROM schedule WHERE name = ?').get('From Test') as {
			id: string;
			name: string;
		};
		expect(row.name).toBe('From Test');
		const slots = getDatabase()
			.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
			.all(row.id) as { scheduled_at: string }[];
		expect(slots.map((s) => s.scheduled_at.slice(0, 16))).toContain('2030-04-01T15:00');
		const sf = getDatabase()
			.prepare('SELECT key, value FROM schedule_field WHERE schedule_id = ? AND key = ?')
			.get(row.id, 'campaign.id') as { key: string; value: string };
		expect(sf.value).toBe('42');
	});

	it('creates schedule from rules_json with two daily rules (overlap allowed)', async () => {
		const rules = JSON.stringify([
			{ type: 'daily', config: { time: '08:00' }, start_at: null, end_at: null },
			{ type: 'daily', config: { time: '20:00' }, start_at: null, end_at: null }
		]);
		try {
			await schedulesNewActions.create?.({
				request: formRequest('http://test/schedules/new', {
					name: 'Dual Daily',
					rules_json: rules
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof schedulesNewActions.create>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expectRedirect(e, 303, '/schedules');
		}
		const sch = getDatabase().prepare('SELECT id FROM schedule WHERE name = ?').get('Dual Daily') as { id: string };
		const n = (
			getDatabase().prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(sch.id) as { n: number }
		).n;
		expect(n).toBe(2);
	});
});

describe('schedules/[id]/+page.server', () => {
	it('load returns schedule, slots, rules, fields', async () => {
		const sid = 'sched-detail';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2030-05-01T12:00:00'], { name: 'Detail Me' });
		insertScheduleRule(sid, 'once', { at: '2030-05-02T12:00:00' }, 0);
		const r = await scheduleDetailLoad(
			{
				...mockRequestEvent({ userId: TEST_USER_ID }, `http://test/schedules/${sid}`),
				params: { id: sid }
			} as Parameters<typeof scheduleDetailLoad>[0]
		);
		expect(r.schedule.name).toBe('Detail Me');
		expect(r.slots.length).toBe(1);
		expect(r.rules.length).toBe(1);
	});

	it('applySchedule assigns slots to two posts when schedule has two legacy slots', async () => {
		const sid = 'sched-apply';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2030-06-01T10:00:00', '2030-06-02T10:00:00'], { name: 'Apply' });
		insertPostRow({ id: 'ap1', title: 'A1', status: 'draft' });
		insertPostRow({ id: 'ap2', title: 'A2', status: 'draft' });
		const res = await scheduleDetailActions.applySchedule?.({
			request: formRequest('http://test/schedules/x', { post_ids: 'ap1,ap2' }),
			locals: { userId: TEST_USER_ID },
			params: { id: sid },
			...({} as never)
		} as Parameters<NonNullable<typeof scheduleDetailActions.applySchedule>>[0]);
		expect(res).toMatchObject({ applied: true, count: 2 });
		const t1 = (
			getDatabase().prepare('SELECT scheduled_at, schedule_id, status FROM post WHERE id = ?').get('ap1') as {
				scheduled_at: string;
				schedule_id: string;
				status: string;
			}
		).scheduled_at;
		expect(t1.slice(0, 10)).toBe('2030-06-01');
		const t2 = (
			getDatabase().prepare('SELECT scheduled_at FROM post WHERE id = ?').get('ap2') as { scheduled_at: string }
		).scheduled_at;
		expect(t2.slice(0, 10)).toBe('2030-06-02');
	});

	it('update replaces rules_json and redirects', async () => {
		const sid = 'sched-update-rules';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2030-06-10T10:00:00'], { name: 'Upd' });
		const rules = JSON.stringify([{ type: 'daily', config: { time: '11:00' }, start_at: null, end_at: null }]);
		try {
			await scheduleDetailActions.update?.({
				request: formRequest('http://test/schedules/x', {
					name: 'Updated Name',
					description: '',
					color: '',
					rules_json: rules,
					field_key_0: 'k',
					field_type_0: 'string',
					field_value_0: 'v'
				}),
				locals: { userId: TEST_USER_ID },
				params: { id: sid },
				...({} as never)
			} as Parameters<NonNullable<typeof scheduleDetailActions.update>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expectRedirect(e, 303, '/schedules');
		}
		const n = (getDatabase().prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(sid) as { n: number }).n;
		expect(n).toBe(1);
	});

	it('applySchedule uses generateSlots when schedule has rules', async () => {
		const sid = 'sched-apply-rules';
		getDatabase()
			.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, ?)')
			.run(sid, TEST_USER_ID, 'RuleApply', null);
		getDatabase().prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(sid);
		insertScheduleRule(sid, 'daily', { time: '16:00' }, 0);
		insertPostRow({ id: 'ar1', title: 'R1', status: 'draft' });
		insertPostRow({ id: 'ar2', title: 'R2', status: 'draft' });
		const res = await scheduleDetailActions.applySchedule?.({
			request: formRequest('http://test/schedules/x', { post_ids: 'ar1,ar2' }),
			locals: { userId: TEST_USER_ID },
			params: { id: sid },
			...({} as never)
		} as Parameters<NonNullable<typeof scheduleDetailActions.applySchedule>>[0]);
		expect(res).toMatchObject({ applied: true, count: 2 });
	});

	it('reschedulePosts updates slots from rules', async () => {
		const sid = 'sched-resched';
		getDatabase()
			.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, ?)')
			.run(sid, TEST_USER_ID, 'Resched', null);
		getDatabase().prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(sid);
		insertScheduleRule(sid, 'daily', { time: '08:00' }, 0);
		insertPostRow({
			id: 'rs1',
			title: 'RS',
			status: 'scheduled',
			scheduled_at: '2035-01-01T08:00:00',
			schedule_id: sid
		});
		const res = await scheduleDetailActions.reschedulePosts?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: { id: sid },
			...({} as never)
		} as Parameters<NonNullable<typeof scheduleDetailActions.reschedulePosts>>[0]);
		expect(res).toMatchObject({ rescheduled: true });
	});

	it('load redirects when schedule missing', async () => {
		try {
			await scheduleDetailLoad({
				...mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/schedules/nope'),
				params: { id: 'missing-schedule-id' }
			} as Parameters<typeof scheduleDetailLoad>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expectRedirect(e, 303, '/schedules');
		}
	});

	it('applySchedule updates existing post_field keys from schedule_field', async () => {
		const sid = 'sched-merge-fields';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2044-01-01T11:00:00', '2044-01-02T11:00:00'], { name: 'MergeFld' });
		const db = getDatabase();
		const fid = crypto.randomUUID();
		db.prepare('INSERT INTO schedule_field (id, schedule_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(
			fid,
			sid,
			'campaign.id',
			'string',
			'from-schedule'
		);
		insertPostRow({ id: 'merge-p1', title: 'M1', status: 'draft' });
		const existingFid = crypto.randomUUID();
		db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(
			existingFid,
			'merge-p1',
			'campaign.id',
			'string',
			'old'
		);
		const res = await scheduleDetailActions.applySchedule?.({
			request: formRequest('http://test/schedules/x', { post_ids: 'merge-p1' }),
			locals: { userId: TEST_USER_ID },
			params: { id: sid },
			...({} as never)
		} as Parameters<NonNullable<typeof scheduleDetailActions.applySchedule>>[0]);
		expect(res).toMatchObject({ applied: true, count: 1 });
		const val = (
			db.prepare('SELECT value FROM post_field WHERE post_id = ? AND key = ?').get('merge-p1', 'campaign.id') as {
				value: string;
			}
		).value;
		expect(val).toBe('from-schedule');
	});
});

describe('reports/+page.server load', () => {
	it('returns empty reports when not logged in', async () => {
		const r = await reportsLoad(
			mockRequestEvent({ userId: null }, 'http://test/reports?report=logs') as Parameters<typeof reportsLoad>[0]
		);
		expect(r.reports).toEqual([]);
		expect(r.reportType).toBe('logs');
		expect(r.callbackStages).toEqual([]);
		expect(r.upcomingPosts).toEqual([]);
		expect(r.lastPublishedPosts).toEqual([]);
		expect(r.failedPosts).toEqual([]);
		expect(r.postsWithFailedStages).toEqual([]);
	});

	it('reflects statistics in URL when not logged in', async () => {
		const r = await reportsLoad(
			mockRequestEvent({ userId: null }, 'http://test/reports?report=statistics') as Parameters<typeof reportsLoad>[0]
		);
		expect(r.reportType).toBe('statistics');
		expect(r.reports).toEqual([]);
		expect(r.callbackStages).toEqual([]);
	});

	it('statistics report loads lists and skips send_log when logged in', async () => {
		const r = await reportsLoad(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/reports?report=statistics') as Parameters<
				typeof reportsLoad
			>[0]
		);
		expect(r.reportType).toBe('statistics');
		expect(r.reports).toEqual([]);
		expect(r.callbackStages).toEqual([]);
		expect(Array.isArray(r.upcomingPosts)).toBe(true);
		expect(Array.isArray(r.lastPublishedPosts)).toBe(true);
	});

	it('returns logs scoped to account with post and webhook titles', async () => {
		const r = await reportsLoad(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/reports?report=logs') as Parameters<typeof reportsLoad>[0]
		);
		expect(r.reportType).toBe('logs');
		expect(r.reports.length).toBe(1);
		expect(r.reports[0].post_title).toBe('Report Post');
		expect(r.reports[0].webhook_name).toBe('Test Webhook');
		expect(r.reports[0].request_json).toBe('{"x":1}');
		expect(Array.isArray(r.upcomingPosts)).toBe(true);
		expect(Array.isArray(r.lastPublishedPosts)).toBe(true);
		expect(Array.isArray(r.failedPosts)).toBe(true);
		expect(Array.isArray(r.postsWithFailedStages)).toBe(true);
	});

	it('callback-stages report filters and orders', async () => {
		const url =
			'http://test/reports?report=callback-stages&filterStage=review&orderBy=stage&orderDir=asc';
		const r = await reportsLoad(mockRequestEvent({ userId: TEST_USER_ID }, url) as Parameters<typeof reportsLoad>[0]);
		expect(r.reportType).toBe('callback-stages');
		expect(r.callbackStages.length).toBe(1);
		expect(r.callbackStages[0].stage).toBe('review');
		expect(r.callbackOrderBy).toBe('stage');
		expect(r.callbackOrderDir).toBe('asc');
	});

	it('rejects invalid orderBy for callback report (falls back to date)', async () => {
		const url = 'http://test/reports?report=callback-stages&orderBy=inject';
		const r = await reportsLoad(mockRequestEvent({ userId: TEST_USER_ID }, url) as Parameters<typeof reportsLoad>[0]);
		expect(r.callbackOrderBy).toBe('date');
	});

	it('callback-stages applies filterTitle and filterStatus', async () => {
		const url =
			'http://test/reports?report=callback-stages&filterTitle=Report&filterStatus=pass&orderBy=title&orderDir=asc';
		const r = await reportsLoad(mockRequestEvent({ userId: TEST_USER_ID }, url) as Parameters<typeof reportsLoad>[0]);
		expect(r.callbackStages.length).toBeGreaterThanOrEqual(1);
		expect(r.callbackFilters.title).toBe('Report');
		expect(r.callbackFilters.status).toBe('pass');
		expect(r.callbackOrderBy).toBe('title');
	});

	it('does not include send_log rows from other accounts', async () => {
		seedOtherUserWithWebhook();
		insertPostRow({
			id: 'other-rep-post',
			accountId: OTHER_USER_ID,
			webhookId: OTHER_WEBHOOK_ID,
			title: 'Other',
			status: 'sent'
		});
		insertSendLog({
			id: 'log-other-acct',
			accountId: OTHER_USER_ID,
			postId: 'other-rep-post',
			request_json: '{"other":true}',
			success: 1
		});
		const r = await reportsLoad(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/reports?report=logs') as Parameters<typeof reportsLoad>[0]
		);
		expect(r.reports.map((x) => x.id).sort()).toEqual(['log-1']);
		expect(r.reports.some((x) => x.request_json.includes('other'))).toBe(false);
	});
});

describe('reports/+page.server actions', () => {
	it('deleteReport removes a single log by id', async () => {
		insertSendLog({
			id: 'log-to-delete',
			accountId: TEST_USER_ID,
			postId: 'rep-post',
			request_json: '{}',
			success: 1
		});
		const res = await reportsActions.deleteReport?.({
			request: formRequest('http://test/reports', { id: 'log-to-delete' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof reportsActions.deleteReport>>[0]);
		expect(res).toEqual({ success: true });
		expect(getDatabase().prepare('SELECT id FROM send_log WHERE id = ?').get('log-to-delete')).toBeUndefined();
	});

	it('clearLogs removes only account logs', async () => {
		const res = await reportsActions.clearLogs?.({
			request: new Request('http://test/reports'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof reportsActions.clearLogs>>[0]);
		expect(res).toEqual({ success: true });
		const n = (getDatabase().prepare('SELECT COUNT(*) as n FROM send_log WHERE account_id = ?').get(TEST_USER_ID) as { n: number }).n;
		expect(n).toBe(0);
	});
});
