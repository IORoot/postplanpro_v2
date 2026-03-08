import { getDatabase } from '$lib/db/index.js';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const secretKey = env.STRIPE_SECRET_KEY;
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
	if (!secretKey || !webhookSecret) {
		return json({ error: 'Stripe not configured' }, { status: 503 });
	}
	const body = await request.text();
	const sig = request.headers.get('stripe-signature');
	if (!sig) {
		return json({ error: 'Missing stripe-signature' }, { status: 400 });
	}
	const stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });
	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 400 });
	}
	const db = getDatabase();
	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session;
		const userId = session.client_reference_id ?? undefined;
		const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
		const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
		if (userId && customerId && subscriptionId) {
			db.prepare(
				'UPDATE user SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?'
			).run('pro', customerId, subscriptionId, userId);
		}
	} else if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
		const subscription = event.data.object as Stripe.Subscription;
		if (event.type === 'customer.subscription.updated' && subscription.status !== 'canceled' && subscription.status !== 'unpaid') {
			return json({ received: true });
		}
		const subscriptionId = subscription.id;
		db.prepare(
			"UPDATE user SET tier = 'free', stripe_subscription_id = NULL WHERE stripe_subscription_id = ?"
		).run(subscriptionId);
	}
	return json({ received: true });
};
