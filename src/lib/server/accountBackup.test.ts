/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import {
	exportAccountData,
	replaceAccountDataFromBackup,
	parseAccountBackupPayload,
	ACCOUNT_BACKUP_FORMAT,
	ACCOUNT_IMPORT_CONFIRM_PHRASE
} from './accountBackup.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	insertPostRow
} from '../../../tests/helpers/testDb.js';

beforeEach(() => {
	resetTestDatabase('accountBackup');
	seedCallbackTestData();
});

describe('accountBackup', () => {
	it('export then replace restores snapshot after extra rows are added', () => {
		const db = getDatabase();
		insertPostRow({ id: 'p-restore', title: 'Keep me' });

		const exported = exportAccountData(db, TEST_USER_ID, { includeSendLog: false });
		expect(exported.format).toBe(ACCOUNT_BACKUP_FORMAT);
		expect(exported.post.some((p) => p.id === 'p-restore')).toBe(true);

		db.prepare(
			`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
       VALUES ('p-unwanted', ?, ?, 'noise', 'draft', datetime('now'), datetime('now'))`
		).run(TEST_USER_ID, TEST_WEBHOOK_ID);

		const postsBefore = db.prepare('SELECT COUNT(*) as n FROM post WHERE account_id = ?').get(TEST_USER_ID) as { n: number };
		expect(postsBefore.n).toBe(2);

		const roundTrip = parseAccountBackupPayload(JSON.stringify(exported));
		expect(roundTrip.ok).toBe(true);
		if (!roundTrip.ok) throw new Error('parse failed');

		const result = replaceAccountDataFromBackup(db, TEST_USER_ID, roundTrip.payload);
		expect(result.ok).toBe(true);

		const ids = db.prepare('SELECT id FROM post WHERE account_id = ? ORDER BY id').all(TEST_USER_ID) as { id: string }[];
		expect(ids.map((r) => r.id)).toEqual(['p-restore']);
	});

	it('parse rejects invalid format', () => {
		expect(parseAccountBackupPayload({ format: 'other' }).ok).toBe(false);
	});

	it('replace rejects post referencing missing webhook', () => {
		const db = getDatabase();
		insertPostRow({ id: 'p1', title: 'x' });
		const exported = exportAccountData(db, TEST_USER_ID, {});
		const base = exported.post[0];
		if (!base) throw new Error('expected post');
		const bad = {
			...exported,
			post: [{ ...base, id: 'orphan', webhook_id: 'nonexistent-wh', title: 'bad' }]
		};
		const parsed = parseAccountBackupPayload(JSON.stringify(bad));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) throw new Error('parse');
		const result = replaceAccountDataFromBackup(db, TEST_USER_ID, parsed.payload);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected error');
		expect(result.error).toMatch(/missing webhook/i);
	});

	it('confirm phrase constant matches import API expectation', () => {
		expect(ACCOUNT_IMPORT_CONFIRM_PHRASE).toBe('REPLACE MY DATA');
	});
});
