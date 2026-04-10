import { handle as authHandle } from './auth.js';
import type { Session } from '@auth/sveltekit';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getDatabase } from '$lib/db/index.js';
import { startInternalCronIfEnabled } from '$lib/server/internalCron.js';

function isMarketingPublicPath(pathname: string): boolean {
	return pathname === '/' || pathname.startsWith('/welcome');
}

/** Immutable build assets and dev tooling — never need session; skipping avoids extra /auth/session work. */
function skipAuthStabilization(pathname: string): boolean {
	return (
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/@fs/') ||
		pathname.startsWith('/@vite/') ||
		pathname === '/favicon.svg' ||
		pathname === '/favicon.ico' ||
		pathname === '/robots.txt'
	);
}

const appAuthGuard: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Auth.js `auth()` throws if the internal session request returns a non-200 body (e.g. misconfigured AUTH_SECRET / host).
	// Replace it with a stable, non-throwing getter for this request. Must run even when `route.id` is null: the root
	// layout still calls `locals.auth()`, and a null `route.id` early-return previously left the throwing `auth()` in place (500).
	let session: Session | null = null;
	if (!skipAuthStabilization(pathname)) {
		const runAuth = event.locals.auth;
		try {
			session = runAuth ? await runAuth() : null;
		} catch (err) {
			console.error('[auth] session load failed:', err instanceof Error ? err.message : err);
			session = null;
		}
		const stableAuth = async () => session;
		event.locals.auth = stableAuth;
		event.locals.getSession = stableAuth;
		event.locals.userId = session?.user?.id ?? null;
	}

	// Skip static assets and non-routed files (no layout load / redirects)
	if (!event.route.id) return resolve(event);

	const isAuthRoute = pathname.startsWith('/auth');
	const isPublicMarketing = isMarketingPublicPath(pathname);
	const isCronRoute = pathname.startsWith('/api/cron/send-due-posts');
	const isCallbackRoute = pathname.startsWith('/api/callbacks/');
	const isStripeWebhook = pathname === '/api/stripe/webhook';

	// Blocked users: redirect to /blocked (except marketing, auth, and webhooks)
	if (session?.user?.id && !isPublicMarketing && !isAuthRoute && !isCronRoute && !isCallbackRoute && !isStripeWebhook) {
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

	if (!session && !isAuthRoute && !isPublicMarketing && !isCronRoute && !isCallbackRoute && !isStripeWebhook) {
		throw redirect(303, '/');
	}
	// Allow POST actions on /auth/login (e.g. signout), but keep GET redirected.
	if (session && pathname === '/auth/login' && event.request.method === 'GET') {
		throw redirect(303, '/calendar');
	}
	// Logged-in user on marketing home: send to calendar (/welcome redirects to / for guests)
	if (session && (pathname === '/' || pathname === '/welcome') && event.request.method === 'GET') {
		throw redirect(303, '/calendar');
	}

	return resolve(event);
};

/** SSR: match client-side forced dark shell for marketing + auth (see setPathnameForThemeMerge). */
const ssrPublicDarkShell: Handle = async ({ event, resolve }) => {
	const p = event.url.pathname;
	const useDark = p === '/' || p.startsWith('/welcome') || p.startsWith('/auth');
	return resolve(event, {
		transformPageChunk: ({ html, done }) => {
			if (!useDark || !done) return html;
			return html.replace('<html lang="en">', '<html lang="en" class="dark">');
		}
	});
};

/** Baseline hardening for all responses (HTML, JSON, assets). */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const headers = new Headers(response.headers);
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('X-Frame-Options', 'SAMEORIGIN');
	headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

export const handle = sequence(authHandle, appAuthGuard, ssrPublicDarkShell, securityHeaders);

/** Runs once when the Node server starts (adapter-node). Used to send scheduled posts without an external cron. */
export function init() {
	startInternalCronIfEnabled();
}
