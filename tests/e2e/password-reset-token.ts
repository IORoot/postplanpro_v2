import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

function hashToken(rawToken: string): string {
	return createHash('sha256').update(rawToken).digest('hex');
}

/** Inserts a row matching `createAuthToken` in `auth.ts` (purpose `reset_password`). Returns the raw token for the URL. */
export function issueRawPasswordResetToken(dbPath: string, userId: string): string {
	const db = new Database(dbPath);
	try {
		const rawToken = randomBytes(32).toString('hex');
		const tokenHash = hashToken(rawToken);
		const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
		const id = randomUUID();
		db.prepare(
			"INSERT INTO auth_token (id, user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES (?, ?, 'reset_password', ?, ?, NULL, datetime('now'))"
		).run(id, userId, tokenHash, expiresAt);
		return rawToken;
	} finally {
		db.close();
	}
}
