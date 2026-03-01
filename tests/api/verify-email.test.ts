/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../../src/routes/auth/verify-email/+server';

vi.mock('../../src/auth.js', () => ({
	markEmailAsVerified: vi.fn()
}));

const { markEmailAsVerified } = await import('../../src/auth.js');

describe('GET /auth/verify-email', () => {
	it('redirects to /auth/login when token is missing or invalid', async () => {
		vi.mocked(markEmailAsVerified).mockReturnValue(false);
		const request = new Request('http://test/auth/verify-email', { method: 'GET' });
		try {
			await GET({ request, url: new URL(request.url), params: {}, locals: {} });
		} catch (e: unknown) {
			const err = e as { status?: number; location?: string };
			expect(err.status).toBe(303);
			expect(err.location).toBe('/auth/login');
			return;
		}
		expect.fail('Expected redirect to be thrown');
	});

	it('redirects to /auth/login?verified=1 when token is valid', async () => {
		vi.mocked(markEmailAsVerified).mockReturnValue(true);
		const request = new Request('http://test/auth/verify-email?token=valid', {
			method: 'GET'
		});
		try {
			await GET({ request, url: new URL(request.url), params: {}, locals: {} });
		} catch (e: unknown) {
			const err = e as { status?: number; location?: string };
			expect(err.status).toBe(303);
			expect(err.location).toContain('/auth/login');
			expect(err.location).toContain('verified=1');
			return;
		}
		expect.fail('Expected redirect to be thrown');
	});
});
