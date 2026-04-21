/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { clearAuthJsSessionCookies, sessionOnlyIfUserExists } from './authSessionCleanup.js';
import type { Session } from '@auth/sveltekit';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID } from '../../../tests/helpers/testDb.js';

describe('authSessionCleanup', () => {
	it('sessionOnlyIfUserExists returns null when user row is missing', () => {
		resetTestDatabase('auth-session-cleanup-missing');
		seedCallbackTestData();
		const db = getDatabase();
		db.prepare('DELETE FROM user WHERE id = ?').run(TEST_USER_ID);
		const session = { user: { id: TEST_USER_ID, email: 'x@test' } } as Session;
		expect(sessionOnlyIfUserExists(db, session)).toBeNull();
	});

	it('sessionOnlyIfUserExists returns session when user exists', () => {
		resetTestDatabase('auth-session-cleanup-present');
		seedCallbackTestData();
		const db = getDatabase();
		const session = { user: { id: TEST_USER_ID, email: 'x@test' } } as Session;
		expect(sessionOnlyIfUserExists(db, session)).toEqual(session);
	});

	it('clearAuthJsSessionCookies deletes session token cookies', () => {
		const del = vi.fn();
		const cookies = {
			getAll: () => [
				{ name: 'authjs.session-token', value: 'a' },
				{ name: 'authjs.session-token.0', value: 'b' },
				{ name: '__Secure-authjs.session-token', value: 'c' },
				{ name: '__Secure-authjs.session-token.1', value: 'd' },
				{ name: 'other', value: 'x' }
			],
			delete: del
		} as unknown as import('@sveltejs/kit').Cookies;
		clearAuthJsSessionCookies(cookies);
		expect(del.mock.calls.map((c) => c[0])).toEqual([
			'authjs.session-token',
			'authjs.session-token.0',
			'__Secure-authjs.session-token',
			'__Secure-authjs.session-token.1'
		]);
		for (const call of del.mock.calls) {
			expect(call[1]).toEqual({ path: '/' });
		}
	});
});
