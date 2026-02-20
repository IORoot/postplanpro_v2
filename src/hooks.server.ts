import { handle as authHandle } from './auth.js';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const PUBLIC_PATHS = ['/auth/login'];

const appAuthGuard: Handle = async ({ event, resolve }) => {
	// Skip static assets and non-routed files
	if (!event.route.id) return resolve(event);

	const pathname = event.url.pathname;
	const isAuthRoute = pathname.startsWith('/auth');
	const isPublicRoute = PUBLIC_PATHS.includes(pathname);
	const isCronRoute = pathname.startsWith('/api/cron/send-due-posts');

	const session = await event.locals.auth();
	event.locals.userId = session?.user?.id ?? null;

	if (!session && !isAuthRoute && !isPublicRoute && !isCronRoute) {
		throw redirect(303, '/auth/login');
	}
	// Allow POST actions on /auth/login (e.g. signout), but keep GET redirected.
	if (session && pathname === '/auth/login' && event.request.method === 'GET') {
		throw redirect(303, '/calendar');
	}

	return resolve(event);
};

export const handle = sequence(authHandle, appAuthGuard);
