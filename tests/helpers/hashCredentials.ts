import { randomBytes, scryptSync } from 'node:crypto';

/** Same format as `src/auth.ts` (salt:hex) for seeding test users. */
export function hashPasswordForTest(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}
