import { getDatabase } from '$lib/db/index.js';
import { getUsageForMonth, currentMonthKey } from '$lib/usage.js';
import { requireAdmin } from '$lib/admin.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const VALID_TIERS = ['free', 'pro', 'enterprise', 'admin', 'blocked'] as const;

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getDatabase();
	const month = currentMonthKey();
	const users = db
		.prepare(
			'SELECT id, email, name, tier, created_at FROM user ORDER BY created_at ASC'
		)
		.all() as { id: string; email: string | null; name: string | null; tier: string; created_at: string }[];
	const usersWithUsage = users.map((u) => {
		const usage = getUsageForMonth(db, u.id, month);
		return {
			...u,
			usage: {
				postsTotal: usage.postsSent + usage.postsScheduled,
				callbackInputs: usage.callbackInputs,
				importOperations: usage.importOperations
			}
		};
	});
	return { users: usersWithUsage };
};

export const actions: Actions = {
	updateTier: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = (data.get('user_id') as string)?.trim();
		const tier = (data.get('tier') as string)?.trim()?.toLowerCase();
		if (!userId || !tier) {
			return fail(400, { error: 'Missing user_id or tier.' });
		}
		if (!VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
			return fail(400, { error: 'Invalid tier.' });
		}
		const db = getDatabase();
		const adminCount = db.prepare("SELECT COUNT(*) as n FROM user WHERE tier = 'admin'").get() as { n: number };
		const target = db.prepare('SELECT tier FROM user WHERE id = ?').get(userId) as { tier: string } | undefined;
		if (!target) {
			return fail(404, { error: 'User not found.' });
		}
		if (target.tier === 'admin' && tier !== 'admin' && adminCount.n <= 1) {
			return fail(400, { error: 'Cannot demote the last admin.' });
		}
		db.prepare('UPDATE user SET tier = ? WHERE id = ?').run(tier, userId);
		return { updated: true };
	}
};
