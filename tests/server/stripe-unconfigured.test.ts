/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resetTestDatabase, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const USER = 'stripe-unconf-user';

beforeAll(() => {
	resetTestDatabase('stripe-unconfigured');
	seedVerifiedUserWithPassword(USER, 'n@stripe.test', 'Passw0rd!', 'free');
});

describe('Stripe routes when env keys missing', () => {
	it('checkout returns 503', async () => {
		const { GET } = await import('../../src/routes/api/stripe/checkout/+server.js');
		const res = await GET(mockRequestEvent({ userId: USER }, 'http://test/checkout') as Parameters<typeof GET>[0]);
		expect(res.status).toBe(503);
	});

	it('portal returns 503', async () => {
		const { GET } = await import('../../src/routes/api/stripe/portal/+server.js');
		const res = await GET(mockRequestEvent({ userId: USER }, 'http://test/portal') as Parameters<typeof GET>[0]);
		expect(res.status).toBe(503);
	});

	it('webhook returns 503', async () => {
		const { POST } = await import('../../src/routes/api/stripe/webhook/+server.js');
		const res = await POST({
			request: new Request('http://test', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'x' } })
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(503);
	});
});
