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
		expect(r.section).toBe('account');
		expect(Array.isArray(r.templates)).toBe(true);
		expect(Array.isArray(r.globals)).toBe(true);
		expect(r.email).toBeTruthy();
		expect(r.hasPassword).toBe(true);
		expect(r.oauthAccounts.length).toBeGreaterThanOrEqual(1);
		expect(r.canDisconnectOAuth).toBe(true);
	});

	it('honors section=templates', async () => {
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account?section=templates') as Parameters<typeof load>[0]
		);
		expect(r.section).toBe('templates');
	});

	it('honors section=settings', async () => {
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account?section=settings') as Parameters<typeof load>[0]
		);
		expect(r.section).toBe('settings');
	});

	it('redirects legacy outputs section to /outputs', async () => {
		await expect(
			load(
				mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account?section=outputs') as Parameters<typeof load>[0]
			)
		).rejects.toMatchObject({ status: 303, location: '/outputs' });
	});

	it('redirects legacy inputs section to inputs callbacks', async () => {
		await expect(
			load(
				mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account?section=inputs') as Parameters<typeof load>[0]
			)
		).rejects.toMatchObject({ status: 303, location: '/inputs?section=callbacks' });
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

	it('disconnectOAuth rejects credentials provider', async () => {
		const db = getDatabase();
		db.prepare(
			'INSERT OR REPLACE INTO oauth_account (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)'
		).run('oa-cred', TEST_USER_ID, 'credentials', TEST_USER_ID);
		const res = await actions.disconnectOAuth?.({
			request: formRequest('http://test', { oauth_id: 'oa-cred' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.disconnectOAuth>>[0]);
		expect(res).toMatchObject({ status: 400 });
		expect(
			getDatabase().prepare('SELECT id FROM oauth_account WHERE id = ?').get('oa-cred')
		).toBeDefined();
	});

	it('createGlobal and updateGlobal', async () => {
		await actions.createGlobal?.({
			request: formRequest('http://test/account', { key: 'g1', value: 'v1', type: 'string' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createGlobal>>[0]);
		const id = (getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('g1') as { id: string }).id;
		await actions.updateGlobal?.({
			request: formRequest('http://test/account', { id, key: 'g1', value: 'v2', type: 'number' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateGlobal>>[0]);
		const v = (getDatabase().prepare('SELECT value FROM global_variable WHERE id = ?').get(id) as { value: string }).value;
		expect(v).toBe('v2');
	});

	it('createTemplate requires at least one field', async () => {
		const res = await actions.createTemplate?.({
			request: formRequest('http://test/account', { name: 'Empty', fields_json: '[]' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('createTemplate stores dotted keys and types', async () => {
		const fields = JSON.stringify([
			{ key: 'meta.author', type: 'string', value: 'Ann' },
			{ key: 'meta.count', type: 'number', value: '3' }
		]);
		const res = await actions.createTemplate?.({
			request: formRequest('http://test/account', { name: 'Tmpl', fields_json: fields }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		expect(res).toEqual({ success: true });
		const tid = (getDatabase().prepare('SELECT id FROM field_template WHERE name = ? AND account_id = ?').get('Tmpl', TEST_USER_ID) as {
			id: string;
		}).id;
		const keys = getDatabase()
			.prepare('SELECT key, type FROM field_template_field WHERE template_id = ? ORDER BY key')
			.all(tid) as { key: string; type: string }[];
		expect(keys).toContainEqual({ key: 'meta.author', type: 'string' });
		expect(keys).toContainEqual({ key: 'meta.count', type: 'number' });
	});

	it('deleteGlobal removes row', async () => {
		await actions.createGlobal?.({
			request: formRequest('http://test/account', { key: 'to-del', value: 'x', type: 'string' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createGlobal>>[0]);
		const gid = (getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('to-del') as { id: string }).id;
		await actions.deleteGlobal?.({
			request: formRequest('http://test/account', { id: gid }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteGlobal>>[0]);
		expect(getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('to-del')).toBeUndefined();
	});

	it('updateTemplate updates user-owned template', async () => {
		const fields = JSON.stringify([{ key: 'a', type: 'string', value: '1' }]);
		await actions.createTemplate?.({
			request: formRequest('http://test/account', { name: 'MyT', fields_json: fields }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		const tid = (getDatabase().prepare('SELECT id FROM field_template WHERE name = ? AND account_id = ?').get('MyT', TEST_USER_ID) as {
			id: string;
		}).id;
		const res = await actions.updateTemplate?.({
			request: formRequest('http://test/account', {
				id: tid,
				name: 'MyT2',
				fields_json: JSON.stringify([{ key: 'b', type: 'string', value: '2' }])
			}),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTemplate>>[0]);
		expect(res).toEqual({ success: true });
		const keys = getDatabase()
			.prepare('SELECT key FROM field_template_field WHERE template_id = ?')
			.all(tid) as { key: string }[];
		expect(keys.map((k) => k.key)).toContain('b');
	});

	it('updateTemplate returns 403 for default template', async () => {
		const row = getDatabase().prepare('SELECT id FROM field_template WHERE is_default = 1 LIMIT 1').get() as { id: string };
		const res = await actions.updateTemplate?.({
			request: formRequest('http://test/account', {
				id: row.id,
				name: 'X',
				fields_json: JSON.stringify([{ key: 'z', type: 'string', value: '' }])
			}),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTemplate>>[0]);
		expect(res).toMatchObject({ status: 403 });
	});

	it('deleteTemplate returns 403 for default template', async () => {
		const row = getDatabase().prepare('SELECT id FROM field_template WHERE is_default = 1 LIMIT 1').get() as { id: string };
		const res = await actions.deleteTemplate?.({
			request: formRequest('http://test/account', { id: row.id }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteTemplate>>[0]);
		expect(res).toMatchObject({ status: 403 });
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
