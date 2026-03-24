/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

const stripeMocks = vi.hoisted(() => ({
	checkoutCreate: vi.fn(),
	portalCreate: vi.fn(),
	constructEvent: vi.fn()
}));

vi.mock('stripe', () => ({
	default: class StripeMock {
		checkout = { sessions: { create: stripeMocks.checkoutCreate } };
		billingPortal = { sessions: { create: stripeMocks.portalCreate } };
		webhooks = { constructEvent: stripeMocks.constructEvent };
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_SECRET_KEY: 'sk_test_x',
		STRIPE_PRICE_ID_PRO_MONTHLY: 'price_x',
		STRIPE_WEBHOOK_SECRET: 'whsec_x',
		APP_BASE_URL: 'http://localhost:5173'
	}
}));

const STRIPE_USER = 'stripe-user-1';

beforeAll(() => {
	resetTestDatabase('stripe-routes');
	seedVerifiedUserWithPassword(STRIPE_USER, 'u@stripe.test', 'Passw0rd!', 'free');
});

beforeEach(() => {
	stripeMocks.checkoutCreate.mockReset();
	stripeMocks.portalCreate.mockReset();
	stripeMocks.constructEvent.mockReset();
});

describe('GET /api/stripe/checkout', () => {
	it('redirects to Stripe checkout URL when configured', async () => {
		stripeMocks.checkoutCreate.mockResolvedValue({ url: 'https://stripe.test/session' });
		const { GET } = await import('../../src/routes/api/stripe/checkout/+server.js');
		try {
			await GET(mockRequestEvent({ userId: STRIPE_USER }, 'http://test/stripe/checkout') as Parameters<typeof GET>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: 'https://stripe.test/session' });
		}
	});
});

describe('GET /api/stripe/portal', () => {
	it('redirects to no_customer when user has no stripe_customer_id', async () => {
		const { GET } = await import('../../src/routes/api/stripe/portal/+server.js');
		try {
			await GET(mockRequestEvent({ userId: STRIPE_USER }, 'http://test/stripe/portal') as Parameters<typeof GET>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: '/account?stripe=no_customer' });
		}
	});

	it('redirects to portal URL when customer exists', async () => {
		getDatabase()
			.prepare('UPDATE user SET stripe_customer_id = ? WHERE id = ?')
			.run('cus_test_1', STRIPE_USER);
		stripeMocks.portalCreate.mockResolvedValue({ url: 'https://stripe.test/portal' });
		const { GET } = await import('../../src/routes/api/stripe/portal/+server.js');
		try {
			await GET(mockRequestEvent({ userId: STRIPE_USER }, 'http://test/stripe/portal') as Parameters<typeof GET>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303, location: 'https://stripe.test/portal' });
		}
	});
});

describe('POST /api/stripe/webhook', () => {
	it('returns 400 without stripe-signature', async () => {
		const { POST } = await import('../../src/routes/api/stripe/webhook/+server.js');
		const res = await POST({
			request: new Request('http://test', { method: 'POST', body: '{}' })
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
	});

	it('returns 400 when constructEvent throws', async () => {
		stripeMocks.constructEvent.mockImplementation(() => {
			throw new Error('invalid signature');
		});
		const { POST } = await import('../../src/routes/api/stripe/webhook/+server.js');
		const res = await POST({
			request: new Request('http://test', {
				method: 'POST',
				headers: { 'stripe-signature': 'bad' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/invalid signature/);
	});

	it('updates user tier on checkout.session.completed', async () => {
		stripeMocks.constructEvent.mockReturnValue({
			type: 'checkout.session.completed',
			data: {
				object: {
					client_reference_id: STRIPE_USER,
					customer: 'cus_abc',
					subscription: 'sub_abc'
				}
			}
		});
		const { POST } = await import('../../src/routes/api/stripe/webhook/+server.js');
		const res = await POST({
			request: new Request('http://test', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		const tier = (getDatabase().prepare('SELECT tier FROM user WHERE id = ?').get(STRIPE_USER) as { tier: string }).tier;
		expect(tier).toBe('pro');
	});

	it('downgrades user on customer.subscription.deleted', async () => {
		getDatabase()
			.prepare('UPDATE user SET tier = ?, stripe_subscription_id = ? WHERE id = ?')
			.run('pro', 'sub_down', STRIPE_USER);
		stripeMocks.constructEvent.mockReturnValue({
			type: 'customer.subscription.deleted',
			data: { object: { id: 'sub_down' } }
		});
		const { POST } = await import('../../src/routes/api/stripe/webhook/+server.js');
		const res = await POST({
			request: new Request('http://test', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig' },
				body: '{}'
			})
		} as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		const tier = (getDatabase().prepare('SELECT tier FROM user WHERE id = ?').get(STRIPE_USER) as { tier: string }).tier;
		expect(tier).toBe('free');
	});
});
