import { getDatabase } from '$lib/db/index.js';
import { getUsageForMonth, currentMonthKey } from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
import { sendResetPasswordEmail, signOut } from '../../auth.js';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/auth/login?callbackUrl=' + encodeURIComponent(url.pathname));
	}
	const userId = session.user.id as string;
	const db = getDatabase();

	const user = db
		.prepare('SELECT email, password_hash, tier FROM user WHERE id = ?')
		.get(userId) as { email: string | null; password_hash: string | null; tier: string } | undefined;
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const tier = user.tier ?? 'free';
	const limits = getTierLimits(tier);
	const month = currentMonthKey();
	const usage = getUsageForMonth(db, userId, month);
	const postsTotal = usage.postsSent + usage.postsScheduled;

	const oauthAccounts = db
		.prepare('SELECT id, provider, provider_account_id, created_at FROM oauth_account WHERE user_id = ? ORDER BY provider')
		.all(userId) as { id: string; provider: string; provider_account_id: string; created_at: string }[];
	const providerLabels: Record<string, string> = {
		google: 'Google',
		github: 'GitHub',
		apple: 'Apple',
		facebook: 'Facebook'
	};

	return {
		email: user.email ?? null,
		hasPassword: !!user.password_hash,
		tier,
		usage: {
			postsSent: usage.postsSent,
			postsScheduled: usage.postsScheduled,
			postsTotal,
			callbackInputs: usage.callbackInputs,
			importOperations: usage.importOperations
		},
		limits: {
			postsSentPerMonth: limits.postsSentPerMonth,
			callbackInputsPerMonth: limits.callbackInputsPerMonth,
			importOperationsPerMonth: limits.importOperationsPerMonth
		},
		oauthAccounts: oauthAccounts.map((o) => ({
			id: o.id,
			provider: o.provider,
			label: providerLabels[o.provider] ?? o.provider,
			created_at: o.created_at
		})),
		canDisconnectOAuth: user.password_hash != null || oauthAccounts.length > 1
	};
};

export const actions: Actions = {
	sendResetPassword: async ({ request, locals, url }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const db = getDatabase();
		const row = db.prepare('SELECT email FROM user WHERE id = ?').get(userId) as { email: string | null } | undefined;
		if (!row?.email) {
			return fail(400, { error: 'No email on file. Add an email to your account to use password reset.' });
		}
		const result = await sendResetPasswordEmail(userId, row.email, url.origin);
		if (result.ok === false) return fail(500, { error: result.error ?? 'Failed to send email.' });
		return { resetSent: true, message: 'A password reset link has been sent to your email.' };
	},

	disconnectOAuth: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const data = await request.formData();
		const oauthId = (data.get('oauth_id') as string)?.trim();
		if (!oauthId) return fail(400, { error: 'Missing oauth account id.' });
		const db = getDatabase();
		const row = db
			.prepare('SELECT id FROM oauth_account WHERE id = ? AND user_id = ?')
			.get(oauthId, userId) as { id: string } | undefined;
		if (!row) return fail(404, { error: 'OAuth account not found.' });
		const hasPassword = db.prepare('SELECT 1 FROM user WHERE id = ? AND password_hash IS NOT NULL').get(userId);
		const oauthCount = db.prepare('SELECT COUNT(*) as n FROM oauth_account WHERE user_id = ?').get(userId) as { n: number };
		if (!hasPassword && oauthCount.n <= 1) {
			return fail(400, { error: 'Cannot disconnect the only sign-in method. Set a password first, or add another provider.' });
		}
		db.prepare('DELETE FROM oauth_account WHERE id = ? AND user_id = ?').run(oauthId, userId);
		return { disconnectOk: true };
	},

	deleteAccount: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const data = await event.request.formData();
		const confirm = (data.get('confirm') as string)?.trim()?.toLowerCase();
		if (confirm !== 'delete') {
			return fail(400, { error: 'Type DELETE to confirm account deletion.' });
		}
		const db = getDatabase();
		db.prepare('DELETE FROM user WHERE id = ?').run(userId);
		return signOut(event);
	}
};
