import type { Cookies } from '@sveltejs/kit';
import type { Session } from '@auth/sveltekit';
import type { Database } from 'better-sqlite3';

/**
 * Auth.js session JWT can outlive a deleted `user` row. Drop session cookies so the client is logged out.
 */
export function clearAuthJsSessionCookies(cookies: Cookies): void {
	for (const { name } of cookies.getAll()) {
		const isChunkedSession =
			name.startsWith('authjs.session-token.') || name.startsWith('__Secure-authjs.session-token.');
		const isUnchunkedSession =
			name === 'authjs.session-token' || name === '__Secure-authjs.session-token';
		if (isUnchunkedSession || isChunkedSession) {
			cookies.delete(name, { path: '/' });
		}
	}
}

/** Returns the session only if that user still exists in the database. */
export function sessionOnlyIfUserExists(db: Database, session: Session | null): Session | null {
	const id = session?.user?.id;
	if (!id) return session;
	const row = db.prepare('SELECT 1 FROM user WHERE id = ?').get(id);
	return row ? session : null;
}
