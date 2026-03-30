import { getDatabase } from '$lib/db/index.js';
import { getStripeSecrets } from '$lib/server/stripeEnv.js';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/auth/login');
	}
	const { secretKey } = getStripeSecrets();
	if (!secretKey) {
		return new Response('Stripe is not configured.', { status: 503 });
	}
	const db = getDatabase();
	const user = db
		.prepare('SELECT stripe_customer_id FROM user WHERE id = ?')
		.get(session.user.id) as { stripe_customer_id: string | null } | undefined;
	if (!user?.stripe_customer_id) {
		throw redirect(303, '/account?stripe=no_customer');
	}
	const origin = env.APP_BASE_URL || 'http://localhost:5173';
	const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
	const portalSession = await stripe.billingPortal.sessions.create({
		customer: user.stripe_customer_id,
		return_url: `${origin}/account`
	});
	if (portalSession.url) {
		throw redirect(303, portalSession.url);
	}
	return new Response('Could not create portal session.', { status: 500 });
};
