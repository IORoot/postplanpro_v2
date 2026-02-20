import { getDatabase } from '$lib/db/index.js';
import { env } from '$env/dynamic/private';
import type { Provider } from '@auth/core/providers';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SvelteKitAuth } from '@auth/sveltekit';
import Apple from '@auth/sveltekit/providers/apple';
import Credentials from '@auth/sveltekit/providers/credentials';
import Facebook from '@auth/sveltekit/providers/facebook';
import GitHub from '@auth/sveltekit/providers/github';
import Google from '@auth/sveltekit/providers/google';
import { sendAuthEmail } from '$lib/server/email.js';

type ProviderMeta = { id: string; label: string };

function providerIfConfigured(
	meta: ProviderMeta,
	clientId: string | undefined,
	clientSecret: string | undefined,
	factory: (opts: { clientId: string; clientSecret: string }) => Provider
) {
	if (!clientId || !clientSecret) return null;
	return { provider: factory({ clientId, clientSecret }), meta };
}

const configuredProviders = [
	providerIfConfigured(
		{ id: 'google', label: 'Google' },
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		Google
	),
	providerIfConfigured(
		{ id: 'apple', label: 'Apple' },
		env.APPLE_ID,
		env.APPLE_SECRET,
		Apple
	),
	providerIfConfigured(
		{ id: 'github', label: 'GitHub' },
		env.GITHUB_ID,
		env.GITHUB_SECRET,
		GitHub
	),
	providerIfConfigured(
		{ id: 'facebook', label: 'Facebook' },
		env.FACEBOOK_CLIENT_ID,
		env.FACEBOOK_CLIENT_SECRET,
		Facebook
	)
].filter((p): p is { provider: Provider; meta: ProviderMeta } => p !== null);

export const enabledProviders = configuredProviders.map((p) => p.meta);
const trustHost =
	env.AUTH_TRUST_HOST != null
		? env.AUTH_TRUST_HOST === 'true'
		: env.NODE_ENV !== 'production';
const authSecret =
	env.AUTH_SECRET ??
	(env.NODE_ENV !== 'production'
		? 'dev-only-auth-secret-change-me'
		: undefined);

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
	const [salt, expectedHex] = stored.split(':');
	if (!salt || !expectedHex) return false;
	const actual = scryptSync(password, salt, 64);
	const expected = Buffer.from(expectedHex, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

function hashToken(rawToken: string): string {
	return createHash('sha256').update(rawToken).digest('hex');
}

type AuthTokenPurpose = 'verify_email' | 'reset_password';

function createAuthToken(
	userId: string,
	purpose: AuthTokenPurpose,
	ttlMinutes: number
): string {
	const db = getDatabase();
	const rawToken = randomBytes(32).toString('hex');
	const tokenHash = hashToken(rawToken);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
	db.prepare(
		"INSERT INTO auth_token (id, user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'))"
	).run(crypto.randomUUID(), userId, purpose, tokenHash, expiresAt);
	return rawToken;
}

function consumeAuthToken(rawToken: string, purpose: AuthTokenPurpose): string | null {
	const db = getDatabase();
	const tokenHash = hashToken(rawToken);
	const now = new Date().toISOString();
	const row = db
		.prepare(
			'SELECT id, user_id FROM auth_token WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?'
		)
		.get(tokenHash, purpose, now) as { id: string; user_id: string } | undefined;
	if (!row) return null;
	db.prepare("UPDATE auth_token SET used_at = datetime('now') WHERE id = ?").run(row.id);
	return row.user_id;
}

function getLoginOrigin(originHint?: string): string {
	const explicit = env.APP_BASE_URL?.trim();
	const origin = explicit && explicit.length > 0 ? explicit : originHint;
	if (!origin) throw new Error('App base URL missing.');
	return origin.replace(/\/$/, '');
}

export async function sendVerificationEmail(
	userId: string,
	email: string,
	originHint?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const token = createAuthToken(userId, 'verify_email', 60);
	const origin = getLoginOrigin(originHint);
	const verifyUrl = `${origin}/auth/verify-email?token=${encodeURIComponent(token)}`;
	return sendAuthEmail({
		to: email,
		subject: 'Verify your PostPlan account',
		text: `Verify your account by opening this one-time link (valid for 60 minutes): ${verifyUrl}`,
		html: `<p>Verify your PostPlan account by clicking this one-time link (valid for 60 minutes):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
	});
}

export async function sendResetPasswordEmail(
	userId: string,
	email: string,
	originHint?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const token = createAuthToken(userId, 'reset_password', 30);
	const origin = getLoginOrigin(originHint);
	const resetUrl = `${origin}/auth/reset-password?token=${encodeURIComponent(token)}`;
	return sendAuthEmail({
		to: email,
		subject: 'Reset your PostPlan password',
		text: `Reset your password using this one-time link (valid for 30 minutes): ${resetUrl}`,
		html: `<p>Reset your PostPlan password using this one-time link (valid for 30 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
	});
}

function ensureOAuthUser(input: {
	provider: string;
	providerAccountId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
}): string {
	const db = getDatabase();

	const linked = db
		.prepare(
			'SELECT user_id FROM oauth_account WHERE provider = ? AND provider_account_id = ?'
		)
		.get(input.provider, input.providerAccountId) as { user_id: string } | undefined;
	if (linked) return linked.user_id;

	let userId: string | undefined;
	if (input.email) {
		const normalizedEmail = normalizeEmail(input.email);
		const existingUser = db
			.prepare('SELECT id FROM user WHERE email = ?')
			.get(normalizedEmail) as { id: string } | undefined;
		userId = existingUser?.id;
	}
	if (!userId) {
		userId = crypto.randomUUID();
		const email = input.email ? normalizeEmail(input.email) : null;
		db.prepare(
			"INSERT INTO user (id, email, name, image, password_hash, email_verified_at, created_at) VALUES (?, ?, ?, ?, NULL, datetime('now'), datetime('now'))"
		).run(
			userId,
			email,
			input.name ?? null,
			input.image ?? null
		);
	} else {
		db.prepare(
			'UPDATE user SET name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?'
		).run(input.name ?? null, input.image ?? null, userId);
	}

	db.prepare(
		"INSERT INTO oauth_account (id, user_id, provider, provider_account_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
	).run(crypto.randomUUID(), userId, input.provider, input.providerAccountId);

	return userId;
}

export function registerWithEmailPassword(input: {
	email: string;
	password: string;
	name?: string | null;
}): { ok: true; userId: string; email: string } | { ok: false; error: string } {
	const email = normalizeEmail(input.email);
	const password = input.password;
	if (!email || !email.includes('@')) return { ok: false, error: 'Valid email is required.' };
	if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

	const db = getDatabase();
	const existing = db.prepare('SELECT id FROM user WHERE email = ?').get(email) as
		| { id: string }
		| undefined;
	if (existing) return { ok: false, error: 'An account with this email already exists.' };

	const userId = crypto.randomUUID();
	const passwordHash = hashPassword(password);
	db.prepare(
		"INSERT INTO user (id, email, name, image, password_hash, email_verified_at, created_at) VALUES (?, ?, ?, NULL, ?, NULL, datetime('now'))"
	).run(userId, email, input.name?.trim() || null, passwordHash);
	return { ok: true, userId, email };
}

export function markEmailAsVerified(rawToken: string): boolean {
	const userId = consumeAuthToken(rawToken, 'verify_email');
	if (!userId) return false;
	getDatabase()
		.prepare("UPDATE user SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?")
		.run(userId);
	return true;
}

export function requestPasswordReset(input: {
	email: string;
	originHint?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const email = normalizeEmail(input.email);
	const user = getDatabase()
		.prepare('SELECT id, email_verified_at FROM user WHERE email = ?')
		.get(email) as { id: string; email_verified_at: string | null } | undefined;
	if (!user?.email_verified_at) return Promise.resolve({ ok: true });
	return sendResetPasswordEmail(user.id, email, input.originHint);
}

export function resetPasswordWithToken(input: {
	token: string;
	password: string;
}): { ok: true } | { ok: false; error: string } {
	if (input.password.length < 8) {
		return { ok: false, error: 'Password must be at least 8 characters.' };
	}
	const userId = consumeAuthToken(input.token, 'reset_password');
	if (!userId) return { ok: false, error: 'This reset link is invalid or expired.' };
	const passwordHash = hashPassword(input.password);
	getDatabase()
		.prepare('UPDATE user SET password_hash = ? WHERE id = ?')
		.run(passwordHash, userId);
	return { ok: true };
}

const credentialsProvider = Credentials({
	name: 'Email and password',
	credentials: {
		email: { label: 'Email', type: 'email' },
		password: { label: 'Password', type: 'password' }
	},
	authorize: async (credentials) => {
		const email = String(credentials?.email ?? '');
		const password = String(credentials?.password ?? '');
		if (!email || !password) return null;
		const db = getDatabase();
		const user = db
			.prepare('SELECT id, email, name, image, password_hash, email_verified_at FROM user WHERE email = ?')
			.get(normalizeEmail(email)) as
			| {
					id: string;
					email: string | null;
					name: string | null;
					image: string | null;
					password_hash: string | null;
					email_verified_at: string | null;
			  }
			| undefined;
		if (!user?.password_hash) return null;
		if (!user.email_verified_at) return null;
		if (!verifyPassword(password, user.password_hash)) return null;
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image
		};
	}
});

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost,
	secret: authSecret,
	session: { strategy: 'jwt' },
	providers: [credentialsProvider, ...configuredProviders.map((p) => p.provider)],
	callbacks: {
		async signIn({ user, account }) {
			if (!account?.provider) return false;
			if (account.provider === 'credentials') return true;
			if (!account.providerAccountId) return false;
			const userId = ensureOAuthUser({
				provider: account.provider,
				providerAccountId: String(account.providerAccountId),
				email: user.email,
				name: user.name,
				image: user.image
			});
			(user as { id?: string }).id = userId;
			return true;
		},
		async jwt({ token, user }) {
			const u = user as { id?: string } | undefined;
			if (u?.id) {
				token.sub = u.id;
				(token as { userId?: string }).userId = u.id;
			}
			return token;
		},
		async session({ session, token }) {
			const userId =
				(token as { userId?: string }).userId ?? token.sub ?? undefined;
			if (session.user && userId) {
				(session.user as { id?: string }).id = userId;
			}
			return session;
		}
	}
});
