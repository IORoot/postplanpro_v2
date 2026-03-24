/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateSlots, getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	insertScheduleWithSlots,
	insertScheduleRule,
	insertPostRow
} from '../helpers/testDb.js';

function insertScheduleBare(id: string, name: string = 'S'): void {
	const db = getDatabase();
	db.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, ?)').run(
		id,
		TEST_USER_ID,
		name,
		null
	);
	db.prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(id);
	db.prepare('DELETE FROM schedule_rule WHERE schedule_id = ?').run(id);
}

beforeAll(() => {
	resetTestDatabase('generate-slots');
	seedCallbackTestData();
});

describe('generateSlots', () => {
	it('uses legacy schedule_slot rows when no rules', () => {
		const sid = 'gs-legacy';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2031-01-01T10:00:00', '2031-01-02T10:00:00'], { name: 'L' });
		const slots = generateSlots(sid, 5, new Date('2030-01-01'), TEST_USER_ID);
		expect(slots.length).toBe(2);
		expect(slots[0]).toContain('2031-01-01');
	});

	it('generates from daily rule', () => {
		const sid = 'gs-daily';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'daily', { time: '14:30' }, 0);
		const slots = generateSlots(sid, 4, new Date('2032-06-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBeGreaterThanOrEqual(4);
	});

	it('generates from weekly rule', () => {
		const sid = 'gs-weekly';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'weekly', { dayOfWeek: 3, time: '09:00' }, 0);
		const slots = generateSlots(sid, 3, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBeGreaterThanOrEqual(1);
	});

	it('generates from monthly rule', () => {
		const sid = 'gs-monthly';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'monthly', { dayOfMonth: 15, time: '11:00' }, 0);
		const slots = generateSlots(sid, 3, new Date('2032-03-10T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBeGreaterThanOrEqual(1);
	});

	it('generates from yearly rule', () => {
		const sid = 'gs-yearly';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'yearly', { month: 6, dayOfMonth: 1, time: '08:00' }, 0);
		const slots = generateSlots(sid, 2, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBeGreaterThanOrEqual(1);
	});

	it('generates from interval rule with days unit', () => {
		const sid = 'gs-interval';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'interval', { amount: 2, unit: 'days' }, 0);
		const slots = generateSlots(sid, 3, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBe(3);
	});

	it('generates from once rule when at is in range', () => {
		const sid = 'gs-once';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'once', { at: '2032-12-25T18:00:00.000Z' }, 0);
		const slots = generateSlots(sid, 5, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBe(1);
	});

	it('generates from cron expression (5-field)', () => {
		const sid = 'gs-cron';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'cron', { expression: '0 8 * * *' }, 0);
		const slots = generateSlots(sid, 5, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		expect(slots.length).toBeGreaterThanOrEqual(1);
	});

	it('merges multiple rules and dedupes', () => {
		const sid = 'gs-multi';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'daily', { time: '09:00' }, 0);
		insertScheduleRule(sid, 'daily', { time: '10:00' }, 1);
		const slots = generateSlots(sid, 20, new Date('2032-01-01T12:00:00Z'), TEST_USER_ID);
		const uniq = new Set(slots);
		expect(uniq.size).toBe(slots.length);
		expect(slots.length).toBeGreaterThanOrEqual(2);
	});

	it('works without accountId filter when schedule is unique', () => {
		const sid = 'gs-no-acct';
		insertScheduleBare(sid);
		insertScheduleRule(sid, 'daily', { time: '07:00' }, 0);
		const slots = generateSlots(sid, 2, new Date('2032-02-01T12:00:00Z'));
		expect(slots.length).toBeGreaterThanOrEqual(2);
	});
});

describe('getNextFreeSlot', () => {
	it('returns first slot not taken by another post', () => {
		const sid = 'gs-free';
		insertScheduleWithSlots(sid, TEST_USER_ID, ['2033-01-01T10:00:00', '2033-01-02T10:00:00'], { name: 'Free' });
		insertPostRow({
			id: 'occupies-first',
			title: 'O',
			status: 'scheduled',
			scheduled_at: '2033-01-01T10:00:00',
			schedule_id: sid
		});
		const next = getNextFreeSlot(sid, 'editing-this-post', TEST_USER_ID);
		expect(next).toBeTruthy();
		expect(String(next).slice(0, 10)).toBe('2033-01-02');
	});
});
