import { handle as authHandle } from './auth.js';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getDatabase } from '$lib/db/index.js';

const PUBLIC_PATHS = ['/welcome', '/auth/login'];

const appAuthGuard: Handle = async ({ event, resolve }) => {
	// Skip static assets and non-routed files
	if (!event.route.id) return resolve(event);

	const pathname = event.url.pathname;
	const isAuthRoute = pathname.startsWith('/auth');
	const isPublicRoute = PUBLIC_PATHS.includes(pathname);
	const isCronRoute = pathname.startsWith('/api/cron/send-due-posts');
	const isCallbackRoute = pathname.startsWith('/api/callbacks/');
	const isStripeWebhook = pathname === '/api/stripe/webhook';

	const session = await event.locals.auth();
	event.locals.userId = session?.user?.id ?? null;

	// Blocked users: redirect to welcome (except for welcome and auth)
	if (session?.user?.id && !isPublicRoute && !isAuthRoute && !isCronRoute && !isCallbackRoute && !isStripeWebhook) {
		const db = getDatabase();
		const row = db
			.prepare('SELECT tier FROM user WHERE id = ?')
			.get(session.user.id) as { tier: string } | undefined;
		if (row?.tier === 'blocked') {
			if (pathname !== '/blocked') {
				throw redirect(303, '/blocked');
			}
		}
	}

	if (!session && !isAuthRoute && !isPublicRoute && !isCronRoute && !isCallbackRoute && !isStripeWebhook) {
		throw redirect(303, '/welcome');
	}
	// Allow POST actions on /auth/login (e.g. signout), but keep GET redirected.
	if (session && pathname === '/auth/login' && event.request.method === 'GET') {
		throw redirect(303, '/');
	}
	// Logged-in user on welcome: send to dashboard
	if (session && pathname === '/welcome' && event.request.method === 'GET') {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle = sequence(authHandle, appAuthGuard);
