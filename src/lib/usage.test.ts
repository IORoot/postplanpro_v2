/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
	currentMonthKey,
	monthKeyFromDate,
	getUsageForMonth,
	getPostsSentAndScheduledForMonth,
	getUsageMonthRow,
	incrementUsageMonth,
	canSchedulePostInMonth,
	canRunImportOperation,
	canBulkCreate,
	getPostsSentAndScheduledForMonth
} from './usage.js';
import { setTestDatabasePath, seedCallbackTestData, TEST_USER_ID } from '../../tests/helpers/testDb.js';
import { getDatabase } from '$lib/db/index.js';

beforeAll(() => {
	setTestDatabasePath('usage');
	getDatabase();
	seedCallbackTestData();
});

describe('usage', () => {
	describe('currentMonthKey', () => {
		it('returns YYYY-MM format', () => {
			const key = currentMonthKey();
			expect(key).toMatch(/^\d{4}-\d{2}$/);
		});
	});
	describe('monthKeyFromDate', () => {
		it('returns month key for ISO date', () => {
			expect(monthKeyFromDate('2025-03-15T12:00:00Z')).toBe('2025-03');
			expect(monthKeyFromDate('2025-01-01')).toBe('2025-01');
		});
		it('returns null for null or invalid', () => {
			expect(monthKeyFromDate(null)).toBeNull();
			expect(monthKeyFromDate('invalid')).toBeNull();
		});
	});
	describe('getUsageForMonth', () => {
		it('returns zero usage for new account', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			const usage = getUsageForMonth(db, TEST_USER_ID, month);
			expect(usage.postsSent).toBe(0);
			expect(usage.postsScheduled).toBe(0);
			expect(usage.callbackInputs).toBe(0);
			expect(usage.importOperations).toBe(0);
		});
	});
	describe('incrementUsageMonth', () => {
		it('increments callback_inputs and import_operations', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			incrementUsageMonth(db, TEST_USER_ID, month, { callbackInputs: 5, importOperations: 1 });
			const row = getUsageMonthRow(db, TEST_USER_ID, month);
			expect(row.callback_inputs).toBe(5);
			expect(row.import_operations).toBe(1);
			incrementUsageMonth(db, TEST_USER_ID, month, { callbackInputs: 3, importOperations: 1 });
			const row2 = getUsageMonthRow(db, TEST_USER_ID, month);
			expect(row2.callback_inputs).toBe(8);
			expect(row2.import_operations).toBe(2);
		});
	});
	describe('canSchedulePostInMonth', () => {
		it('allows when under limit for free tier', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			const result = canSchedulePostInMonth(db, TEST_USER_ID, month, 'free');
			expect(result.allowed).toBe(true);
		});
		it('allows for admin tier regardless of count', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			const result = canSchedulePostInMonth(db, TEST_USER_ID, month, 'admin');
			expect(result.allowed).toBe(true);
		});
	});
	describe('canRunImportOperation', () => {
		it('allows when under limit', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			const result = canRunImportOperation(db, TEST_USER_ID, month, 'free');
			expect(result.allowed).toBe(true);
		});
		it('denies when monthly import operations at cap', () => {
			const db = getDatabase();
			const month = currentMonthKey();
			incrementUsageMonth(db, TEST_USER_ID, month, { importOperations: 100 });
			const result = canRunImportOperation(db, TEST_USER_ID, month, 'free');
			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Import operations limit/);
		});
	});

	describe('getPostsSentAndScheduledForMonth', () => {
		it('counts sent and scheduled posts in month', () => {
			const db = getDatabase();
			const month = '2037-05';
			db.prepare(
				`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
         VALUES ('u1', ?, (SELECT id FROM webhook_config WHERE account_id = ? LIMIT 1), 'A', '2037-05-10T10:00:00', 'scheduled', datetime('now'), datetime('now'))`
			).run(TEST_USER_ID, TEST_USER_ID);
			db.prepare(
				`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, sent_at, created_at, updated_at)
         VALUES ('u2', ?, (SELECT id FROM webhook_config WHERE account_id = ? LIMIT 1), 'B', NULL, 'sent', '2037-05-01T10:00:00', datetime('now'), datetime('now'))`
			).run(TEST_USER_ID, TEST_USER_ID);
			const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, TEST_USER_ID, month);
			expect(scheduled).toBeGreaterThanOrEqual(1);
			expect(sent).toBeGreaterThanOrEqual(1);
		});
	});

	describe('canBulkCreate', () => {
		it('denies when post quota for month would be exceeded', () => {
			const db = getDatabase();
			const month = '2038-06';
			// canBulkCreate checks import limits against currentMonthKey(); clear row polluted by other tests.
			db.prepare('DELETE FROM usage_month WHERE account_id = ? AND month = ?').run(TEST_USER_ID, currentMonthKey());
			const wh = (db.prepare('SELECT id FROM webhook_config WHERE account_id = ? LIMIT 1').get(TEST_USER_ID) as { id: string }).id;
			for (let i = 0; i < 20; i++) {
				db.prepare(
					`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '2038-06-01T10:00:00', 'scheduled', datetime('now'), datetime('now'))`
				).run(`bulk-${i}`, TEST_USER_ID, wh, `T${i}`);
			}
			const r = canBulkCreate(db, TEST_USER_ID, 'free', { [month]: 1 });
			expect(r.allowed).toBe(false);
			expect(r.reason).toMatch(/Post limit/);
		});
	});
});
