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
	canRunImportOperation
} from './usage.js';
import { setTestDatabasePath, seedCallbackTestData, TEST_USER_ID } from '../../tests/helpers/testDb.js';
import { getDatabase } from '$lib/db/index.js';

beforeAll(() => {
	setTestDatabasePath();
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
	});
});
