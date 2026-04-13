/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../src/routes/api/account/reset-data/+server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { ACCOUNT_RESET_CONFIRM_PHRASE } from '../../src/lib/accountBackupConstants.js';

beforeEach(() => {
	resetTestDatabase('account-reset');
	seedCallbackTestData();
	insertPostRow({ id: 'p-reset-test', title: 'Will be wiped' });
});

async function postReset(body: Record<string, unknown>, userId: string | null) {
	const request = new Request('http://test/api/account/reset-data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return POST({
		request,
		locals: { userId },
		params: {},
		route: { id: '/api/account/reset-data' }
	} as never);
}

describe('POST /api/account/reset-data', () => {
	it('returns 401 when not signed in', async () => {
		const response = await postReset({ acknowledge: true, confirmReset: ACCOUNT_RESET_CONFIRM_PHRASE }, null);
		expect(response.status).toBe(401);
	});

	it('returns 400 when acknowledge is missing', async () => {
		const response = await postReset({ confirmReset: ACCOUNT_RESET_CONFIRM_PHRASE }, TEST_USER_ID);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/box/i);
	});

	it('returns 400 when phrase is wrong', async () => {
		const response = await postReset({ acknowledge: true, confirmReset: 'wrong' }, TEST_USER_ID);
		expect(response.status).toBe(400);
	});

	it('clears posts and webhooks when confirm is valid', async () => {
		const db = getDatabase();
		expect(
			(db.prepare('SELECT COUNT(*) as n FROM post WHERE account_id = ?').get(TEST_USER_ID) as { n: number }).n
		).toBeGreaterThanOrEqual(1);

		const response = await postReset({ acknowledge: true, confirmReset: ACCOUNT_RESET_CONFIRM_PHRASE }, TEST_USER_ID);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);

		expect(
			(db.prepare('SELECT COUNT(*) as n FROM post WHERE account_id = ?').get(TEST_USER_ID) as { n: number }).n
		).toBe(0);
		expect(
			(db.prepare('SELECT COUNT(*) as n FROM webhook_config WHERE account_id = ?').get(TEST_USER_ID) as { n: number }).n
		).toBe(0);
	});
});
