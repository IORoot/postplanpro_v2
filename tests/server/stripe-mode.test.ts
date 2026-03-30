/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resetTestDatabase, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

const stripeMocks = vi.hoisted(() => ({
	checkoutCreate: vi.fn()
}));

vi.mock('stripe', () => ({
	default: class StripeMock {
		checkout = { sessions: { create: stripeMocks.checkoutCreate } };
		billingPortal = { sessions: { create: vi.fn() } };
		webhooks = { constructEvent: vi.fn() };
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_MODE: 'test',
		STRIPE_SECRET_KEY_TEST: 'sk_test_from_mode',
		STRIPE_PRICE_ID_PRO_MONTHLY_TEST: 'price_from_test_mode',
		STRIPE_WEBHOOK_SECRET_TEST: 'whsec_from_test_mode',
		APP_BASE_URL: 'http://localhost:5173'
	}
}));

const USER = 'stripe-mode-user';

beforeAll(() => {
	resetTestDatabase('stripe-mode');
	seedVerifiedUserWithPassword(USER, 'mode@stripe.test', 'Passw0rd!', 'free');
});

describe('STRIPE_MODE=test', () => {
	it('checkout uses STRIPE_*_TEST keys and reaches Stripe', async () => {
		stripeMocks.checkoutCreate.mockResolvedValue({ url: 'https://stripe.test/checkout' });
		const { GET } = await import('../../src/routes/api/stripe/checkout/+server.js');
		await expect(
			GET(mockRequestEvent({ userId: USER }, 'http://test/checkout') as Parameters<typeof GET>[0])
		).rejects.toMatchObject({ status: 303, location: 'https://stripe.test/checkout' });
		expect(stripeMocks.checkoutCreate).toHaveBeenCalled();
	});
});
