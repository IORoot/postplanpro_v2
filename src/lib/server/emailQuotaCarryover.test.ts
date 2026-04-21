/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	insertPostRow,
	insertSendLog
} from '../../../tests/helpers/testDb.js';
import {
	mergeAccountUsageIntoEmailCarryover,
	normalizeQuotaEmail,
	getEmailQuotaCarryoverForMonth
} from './emailQuotaCarryover.js';
import { getSuccessfulOutputSendCountForMonth, getUsageMonthRow, currentMonthKey, incrementUsageMonth } from '$lib/usage.js';

const RE_REG_USER_ID = 're-reg-user-id';

describe('emailQuotaCarryover', () => {
	it('normalizeQuotaEmail trims and lowercases', () => {
		expect(normalizeQuotaEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
		expect(normalizeQuotaEmail('')).toBeNull();
		expect(normalizeQuotaEmail(null)).toBeNull();
	});

	it('merges send_log counts onto email so re-registration keeps output quota', () => {
		resetTestDatabase('email-quota-carry-sends');
		seedCallbackTestData();
		const db = getDatabase();
		const month = currentMonthKey();
		insertPostRow({ id: 'carry-p1', title: 'P', status: 'sent' });
		insertSendLog({ id: 'sl1', accountId: TEST_USER_ID, postId: 'carry-p1', success: 1 });
		expect(getSuccessfulOutputSendCountForMonth(db, TEST_USER_ID, month)).toBe(1);

		mergeAccountUsageIntoEmailCarryover(db, TEST_USER_ID, 'test@test.com');
		db.prepare('DELETE FROM user WHERE id = ?').run(TEST_USER_ID);

		db.prepare(
			`INSERT INTO user (id, email, email_verified_at, callback_token, tier)
       VALUES (?, 'test@test.com', datetime('now'), 'cb2', 'free')`
		).run(RE_REG_USER_ID);
		const whId = crypto.randomUUID();
		db.prepare('INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
			whId,
			RE_REG_USER_ID,
			'W',
			'https://example.com/h'
		);

		expect(getSuccessfulOutputSendCountForMonth(db, RE_REG_USER_ID, month)).toBe(1);
		expect(getEmailQuotaCarryoverForMonth(db, 'test@test.com', month).output_sends).toBe(1);
	});

	it('merges usage_month callback/import onto email', () => {
		resetTestDatabase('email-quota-carry-cb');
		seedCallbackTestData();
		const db = getDatabase();
		const month = currentMonthKey();
		incrementUsageMonth(db, TEST_USER_ID, month, { callbackInputs: 7, importOperations: 3 });
		mergeAccountUsageIntoEmailCarryover(db, TEST_USER_ID, 'test@test.com');
		db.prepare('DELETE FROM user WHERE id = ?').run(TEST_USER_ID);
		db.prepare(
			`INSERT INTO user (id, email, email_verified_at, callback_token, tier)
       VALUES (?, 'test@test.com', datetime('now'), 'cb3', 'free')`
		).run(RE_REG_USER_ID);
		const row = getUsageMonthRow(db, RE_REG_USER_ID, month);
		expect(row.callback_inputs).toBe(7);
		expect(row.import_operations).toBe(3);
	});

	it('merge with null email is a no-op', () => {
		resetTestDatabase('email-quota-carry-null');
		seedCallbackTestData();
		const db = getDatabase();
		insertPostRow({ id: 'carry-p2', title: 'P', status: 'sent' });
		insertSendLog({ id: 'sl2', accountId: TEST_USER_ID, postId: 'carry-p2', success: 1 });
		expect(() => mergeAccountUsageIntoEmailCarryover(db, TEST_USER_ID, null)).not.toThrow();
		const month = currentMonthKey();
		expect(getEmailQuotaCarryoverForMonth(db, 'test@test.com', month).output_sends).toBe(0);
	});
});
