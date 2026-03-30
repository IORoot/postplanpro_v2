/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { formRequest } from '../helpers/mockRequest.js';

const resetPasswordWithToken = vi.fn();

vi.mock('../../src/auth.js', () => ({
	resetPasswordWithToken
}));

const { load, actions } = await import('../../src/routes/auth/reset-password/+page.server.js');

describe('auth/reset-password/+page.server', () => {
	it('load reads token from query', async () => {
		const r = await load({
			url: new URL('http://test/reset?token=abc123')
		} as Parameters<typeof load>[0]);
		expect(r.token).toBe('abc123');
		expect(r.looksLikeFormActionUrl).toBe(false);
	});

	it('load flags mistaken ?/reset URL (no token)', async () => {
		const r = await load({
			url: new URL('http://test/auth/reset-password?/reset')
		} as Parameters<typeof load>[0]);
		expect(r.token).toBe('');
		expect(r.looksLikeFormActionUrl).toBe(true);
	});

	it('load empty token without form-action noise', async () => {
		const r = await load({
			url: new URL('http://test/auth/reset-password')
		} as Parameters<typeof load>[0]);
		expect(r.token).toBe('');
		expect(r.looksLikeFormActionUrl).toBe(false);
	});

	it('reset returns 400 when token missing', async () => {
		const res = await actions.reset?.({
			request: formRequest('http://test', {
				password: 'GoodPass1!',
				confirmPassword: 'GoodPass1!'
			})
		} as Parameters<NonNullable<typeof actions.reset>>[0]);
		expect(res).toMatchObject({ status: 400 });
		expect((res as { data?: { error?: string } }).data?.error).toMatch(/Missing token/);
	});

	it('reset returns 400 when passwords mismatch', async () => {
		const res = await actions.reset?.({
			request: formRequest('http://test', {
				token: 't',
				password: 'a',
				confirmPassword: 'b'
			})
		} as Parameters<NonNullable<typeof actions.reset>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('reset returns 400 when token reset fails', async () => {
		resetPasswordWithToken.mockReturnValueOnce({ ok: false, error: 'expired' });
		const res = await actions.reset?.({
			request: formRequest('http://test', {
				token: 't',
				password: 'GoodPass1!',
				confirmPassword: 'GoodPass1!'
			})
		} as Parameters<NonNullable<typeof actions.reset>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('reset redirects on success', async () => {
		resetPasswordWithToken.mockReturnValueOnce({ ok: true });
		try {
			await actions.reset?.({
				request: formRequest('http://test', {
					token: 't',
					password: 'GoodPass1!',
					confirmPassword: 'GoodPass1!'
				})
			} as Parameters<NonNullable<typeof actions.reset>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: '/auth/login?passwordReset=1' });
		}
	});
});
