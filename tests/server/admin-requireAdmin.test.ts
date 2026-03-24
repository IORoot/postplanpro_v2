/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { requireAdmin } from '$lib/admin.js';
import { resetTestDatabase, seedAdminUser, ADMIN_USER_ID } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('admin-require');
	seedAdminUser();
});

describe('requireAdmin', () => {
	it('redirects to login when not signed in', () => {
		try {
			requireAdmin(mockRequestEvent({ userId: null }, 'http://test/users') as Parameters<typeof requireAdmin>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: '/auth/login' });
		}
	});

	it('redirects home when user is not admin tier', () => {
		try {
			requireAdmin(
				mockRequestEvent({ userId: 'non-admin' }, 'http://test/users') as Parameters<typeof requireAdmin>[0]
			);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: '/' });
		}
	});

	it('returns admin user id', () => {
		const id = requireAdmin(
			mockRequestEvent({ userId: ADMIN_USER_ID }, 'http://test/users') as Parameters<typeof requireAdmin>[0]
		);
		expect(id).toBe(ADMIN_USER_ID);
	});
});
