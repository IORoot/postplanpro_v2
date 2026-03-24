/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';
import { hashPasswordForTest } from '../helpers/hashCredentials.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

const sendResetPasswordEmail = vi.fn();
const signOut = vi.fn();

vi.mock('../../src/auth.js', () => ({
	sendResetPasswordEmail,
	signOut
}));

const { load, actions } = await import('../../src/routes/account/+page.server.js');

beforeAll(() => {
	resetTestDatabase('account-page');
	seedCallbackTestData();
	const db = getDatabase();
	db.prepare('UPDATE user SET password_hash = ? WHERE id = ?').run(hashPasswordForTest('Secret1!'), TEST_USER_ID);
});

describe('account/+page.server load', () => {
	it('redirects when not signed in', async () => {
		try {
			await load(
				mockRequestEvent({ userId: null }, 'http://test/account') as Parameters<typeof load>[0]
			);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
			expect(String((e as { location?: string }).location)).toContain('/auth/login');
		}
	});

	it('returns usage and oauth-derived fields', async () => {
		const db = getDatabase();
		db.prepare(
			'INSERT OR REPLACE INTO oauth_account (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)'
		).run('oa-1', TEST_USER_ID, 'google', 'sub-123');
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account') as Parameters<typeof load>[0]
		);
		expect(r.email).toBeTruthy();
		expect(r.hasPassword).toBe(true);
		expect(r.oauthAccounts.length).toBeGreaterThanOrEqual(1);
		expect(r.canDisconnectOAuth).toBe(true);
	});
});

describe('account/+page.server actions', () => {
	it('sendResetPassword returns 401 when logged out', async () => {
		const res = await actions.sendResetPassword?.({
			request: new Request('http://test'),
			locals: mockRequestEvent({ userId: null }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.sendResetPassword>>[0]);
		expect(res).toMatchObject({ status: 401 });
	});

	it('sendResetPassword succeeds when email exists', async () => {
		sendResetPasswordEmail.mockResolvedValueOnce({ ok: true });
		const res = await actions.sendResetPassword?.({
			request: new Request('http://test'),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			url: new URL('http://test/account'),
			...({} as never)
		} as Parameters<NonNullable<typeof actions.sendResetPassword>>[0]);
		expect(res).toMatchObject({ resetSent: true });
	});

	it('disconnectOAuth removes row when password exists', async () => {
		const res = await actions.disconnectOAuth?.({
			request: formRequest('http://test', { oauth_id: 'oa-1' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.disconnectOAuth>>[0]);
		expect(res).toMatchObject({ disconnectOk: true });
		const row = getDatabase().prepare('SELECT id FROM oauth_account WHERE id = ?').get('oa-1');
		expect(row).toBeUndefined();
	});

	it('deleteAccount removes user and calls signOut', async () => {
		signOut.mockResolvedValueOnce({ deleted: true });
		const res = await actions.deleteAccount?.({
			request: formRequest('http://test', { confirm: 'delete' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteAccount>>[0]);
		expect(signOut).toHaveBeenCalled();
		expect(res).toEqual({ deleted: true });
	});
});
