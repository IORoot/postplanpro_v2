import { getDatabase } from '$lib/db/index.js';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Require the current user to be an admin. Call from page load or action.
 * Throws redirect to /calendar if not admin.
 */
export function requireAdmin(event: RequestEvent): string {
	const userId = event.locals.userId;
	if (!userId) {
		throw redirect(303, '/auth/login');
	}
	const db = getDatabase();
	const row = db.prepare('SELECT tier FROM user WHERE id = ?').get(userId) as { tier: string } | undefined;
	if (row?.tier !== 'admin') {
		throw redirect(303, '/calendar');
	}
	return userId;
}
