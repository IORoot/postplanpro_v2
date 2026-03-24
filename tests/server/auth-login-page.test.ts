/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { CredentialsSignin } from '@auth/sveltekit';
import { formRequest } from '../helpers/mockRequest.js';

const signIn = vi.fn();
const registerWithEmailPassword = vi.fn();
const sendVerificationEmail = vi.fn();
const requestPasswordReset = vi.fn();

vi.mock('../../src/auth.js', () => ({
	enabledProviders: [{ id: 'google', label: 'Google' }],
	signIn,
	signOut: vi.fn(),
	registerWithEmailPassword,
	sendVerificationEmail,
	requestPasswordReset
}));

const { load, actions } = await import('../../src/routes/auth/login/+page.server.js');

describe('auth/login/+page.server load', () => {
	it('exposes providers and query flags', async () => {
		const r = await load({
			locals: { auth: async () => null },
			url: new URL('http://test/login?verified=1&passwordReset=1')
		} as Parameters<typeof load>[0]);
		expect(r.providers.length).toBeGreaterThanOrEqual(1);
		expect(r.verified).toBe(true);
		expect(r.passwordReset).toBe(true);
	});
});

describe('auth/login/+page.server actions', () => {
	it('signin maps CredentialsSignin to 401 fail', async () => {
		signIn.mockRejectedValueOnce(new CredentialsSignin());
		const res = await actions.signin?.({
			request: new Request('http://test'),
			locals: { auth: async () => null }
		} as Parameters<NonNullable<typeof actions.signin>>[0]);
		expect(res).toMatchObject({ status: 401 });
	});

	it('register returns 400 when registerWithEmailPassword fails', async () => {
		registerWithEmailPassword.mockReturnValueOnce({ ok: false, error: 'weak password' });
		const res = await actions.register?.({
			request: formRequest('http://test', { email: 'a@b.com', password: 'x', name: 'N' }),
			url: new URL('http://test')
		} as Parameters<NonNullable<typeof actions.register>>[0]);
		expect(res).toMatchObject({ status: 400, data: expect.objectContaining({ registerError: 'weak password' }) });
	});

	it('register returns 500 when verification email fails', async () => {
		registerWithEmailPassword.mockReturnValueOnce({
			ok: true,
			userId: 'new-u',
			email: 'new@b.com'
		});
		sendVerificationEmail.mockResolvedValueOnce({ ok: false, error: 'smtp down' });
		const res = await actions.register?.({
			request: formRequest('http://test', { email: 'new@b.com', password: 'GoodPass1!', name: '' }),
			url: new URL('http://test')
		} as Parameters<NonNullable<typeof actions.register>>[0]);
		expect(res).toMatchObject({ status: 500 });
	});

	it('forgotPassword returns 400 when email empty', async () => {
		const res = await actions.forgotPassword?.({
			request: formRequest('http://test', { email: '' }),
			url: new URL('http://test')
		} as Parameters<NonNullable<typeof actions.forgotPassword>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('forgotPassword returns 500 when requestPasswordReset fails', async () => {
		requestPasswordReset.mockReturnValueOnce({ ok: false, error: 'rate limited' });
		const res = await actions.forgotPassword?.({
			request: formRequest('http://test', { email: 'a@b.com' }),
			url: new URL('http://test')
		} as Parameters<NonNullable<typeof actions.forgotPassword>>[0]);
		expect(res).toMatchObject({ status: 500 });
	});
});
