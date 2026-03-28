import { getDatabase } from '$lib/db/index.js';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/auth/login');
	}
	const secretKey = env.STRIPE_SECRET_KEY;
	const priceId = env.STRIPE_PRICE_ID_PRO_MONTHLY;
	if (!secretKey || !priceId) {
		return new Response('Stripe is not configured.', { status: 503 });
	}
	const db = getDatabase();
	const user = db
		.prepare('SELECT email, stripe_customer_id FROM user WHERE id = ?')
		.get(session.user.id) as { email: string | null; stripe_customer_id: string | null } | undefined;
	if (!user) {
		throw redirect(303, '/auth/login');
	}
	const origin = env.APP_BASE_URL || 'http://localhost:5173';
	const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
	const params: Stripe.Checkout.SessionCreateParams = {
		mode: 'subscription',
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${origin}/account?stripe=success`,
		cancel_url: `${origin}/account?stripe=cancelled`,
		client_reference_id: session.user.id
	};
	if (user.stripe_customer_id) {
		params.customer = user.stripe_customer_id;
	} else if (user.email) {
		params.customer_email = user.email;
	}
	const checkoutSession = await stripe.checkout.sessions.create(params);
	if (checkoutSession.url) {
		throw redirect(303, checkoutSession.url);
	}
	return new Response('Could not create checkout session.', { status: 500 });
};
