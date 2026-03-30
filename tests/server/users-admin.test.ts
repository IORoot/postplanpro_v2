/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load, actions } from '../../src/routes/users/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedAdminUser,
	seedVerifiedUserWithPassword,
	ADMIN_USER_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

const VICTIM_ID = 'victim-user-id';

beforeAll(() => {
	resetTestDatabase('users-admin');
	seedAdminUser();
	seedVerifiedUserWithPassword(VICTIM_ID, 'victim@test.com', 'VictimPass1!', 'free');
	getDatabase()
		.prepare(
			'INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
		)
		.run('wh-victim', VICTIM_ID, 'VW', 'https://v.example/h');
	insertPostRow({
		id: 'victim-post',
		accountId: VICTIM_ID,
		webhookId: 'wh-victim',
		title: 'VP',
		status: 'draft'
	});
});

describe('users/+page.server', () => {
	it('redirects non-admin from load', async () => {
		await expect(
			load(
				mockRequestEvent({ userId: VICTIM_ID }, 'http://test/users') as Parameters<typeof load>[0]
			)
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});

	it('admin load lists exactly seeded users', async () => {
		const r = await load(mockRequestEvent({ userId: ADMIN_USER_ID }, 'http://test/users') as Parameters<typeof load>[0]);
		expect(r.users.length).toBe(2);
		const emails = r.users.map((u) => u.email).sort();
		expect(emails).toEqual(['admin@test.com', 'victim@test.com']);
	});

	it('removeUser deletes victim and related posts', async () => {
		const res = await actions.removeUser?.({
			request: formRequest('http://test/users', { user_id: VICTIM_ID }),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.removeUser>>[0]);
		expect(res).toMatchObject({ removed: true });
		expect(getDatabase().prepare('SELECT id FROM user WHERE id = ?').get(VICTIM_ID)).toBeUndefined();
		expect(getDatabase().prepare('SELECT id FROM post WHERE id = ?').get('victim-post')).toBeUndefined();
	});

	it('rejects demoting the last admin', async () => {
		const n = (
			getDatabase().prepare("SELECT COUNT(*) as n FROM user WHERE tier = 'admin'").get() as { n: number }
		).n;
		expect(n).toBe(1);
		const res = await actions.updateTier?.({
			request: formRequest('http://test/users', { user_id: ADMIN_USER_ID, tier: 'free' }),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTier>>[0]);
		expect(res).toMatchObject({ status: 400 });
		const tier = (getDatabase().prepare('SELECT tier FROM user WHERE id = ?').get(ADMIN_USER_ID) as { tier: string }).tier;
		expect(tier).toBe('admin');
	});

	it('updateTier changes tier when another admin exists', async () => {
		const secondAdmin = 'second-admin-id';
		getDatabase()
			.prepare(
				`INSERT OR REPLACE INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
         VALUES (?, 'second@test.com', datetime('now'), 'x', 'admin', 'cb2')`
			)
			.run(secondAdmin);
		const res = await actions.updateTier?.({
			request: formRequest('http://test/users', { user_id: secondAdmin, tier: 'pro' }),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTier>>[0]);
		expect(res).toMatchObject({ updated: true });
		const tier = (getDatabase().prepare('SELECT tier FROM user WHERE id = ?').get(secondAdmin) as { tier: string }).tier;
		expect(tier).toBe('pro');
	});
});
