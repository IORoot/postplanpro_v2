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
	},

	removeUser: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = (data.get('user_id') as string)?.trim();
		if (!userId) {
			return fail(400, { error: 'Missing user_id.' });
		}
		const db = getDatabase();
		const target = db.prepare('SELECT id, tier FROM user WHERE id = ?').get(userId) as
			| { id: string; tier: string }
			| undefined;
		if (!target) {
			return fail(404, { error: 'User not found.' });
		}
		const adminCount = db.prepare("SELECT COUNT(*) as n FROM user WHERE tier = 'admin'").get() as { n: number };
		if (target.tier === 'admin' && adminCount.n <= 1) {
			return fail(400, { error: 'Cannot remove the last admin.' });
		}
		// Delete user and all related data in dependency order (child tables first)
		db.exec('BEGIN TRANSACTION');
		try {
			// send_log (account_id)
			db.prepare('DELETE FROM send_log WHERE account_id = ?').run(userId);
			// post_stage, post_field, post_webhook for this account's posts
			const postIds = db.prepare('SELECT id FROM post WHERE account_id = ?').all(userId) as { id: string }[];
			for (const { id: postId } of postIds) {
				db.prepare('DELETE FROM post_stage WHERE post_id = ?').run(postId);
				db.prepare('DELETE FROM post_field WHERE post_id = ?').run(postId);
				db.prepare('DELETE FROM post_webhook WHERE post_id = ?').run(postId);
			}
			db.prepare('DELETE FROM post WHERE account_id = ?').run(userId);
			// schedule_rule, schedule_slot, schedule_field for this account's schedules
			const scheduleIds = db.prepare('SELECT id FROM schedule WHERE account_id = ?').all(userId) as {
				id: string;
			}[];
			for (const { id: scheduleId } of scheduleIds) {
				db.prepare('DELETE FROM schedule_rule WHERE schedule_id = ?').run(scheduleId);
				db.prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(scheduleId);
				db.prepare('DELETE FROM schedule_field WHERE schedule_id = ?').run(scheduleId);
			}
			db.prepare('DELETE FROM schedule WHERE account_id = ?').run(userId);
			// webhook_header for this account's webhooks, then import_webhook, then webhook_config
			const webhookIds = db.prepare('SELECT id FROM webhook_config WHERE account_id = ?').all(userId) as {
				id: string;
			}[];
			for (const { id: webhookId } of webhookIds) {
				db.prepare('DELETE FROM webhook_header WHERE webhook_id = ?').run(webhookId);
			}
			db.prepare('DELETE FROM import_webhook WHERE account_id = ?').run(userId);
			db.prepare('DELETE FROM webhook_config WHERE account_id = ?').run(userId);
			db.prepare('DELETE FROM global_variable WHERE account_id = ?').run(userId);
			// field_template_field for this account's templates
			const templateIds = db.prepare('SELECT id FROM field_template WHERE account_id = ?').all(userId) as {
				id: string;
			}[];
			for (const { id: templateId } of templateIds) {
				db.prepare('DELETE FROM field_template_field WHERE template_id = ?').run(templateId);
			}
			db.prepare('DELETE FROM field_template WHERE account_id = ?').run(userId);
			db.prepare('DELETE FROM usage_month WHERE account_id = ?').run(userId);
			db.prepare('DELETE FROM oauth_account WHERE user_id = ?').run(userId);
			db.prepare('DELETE FROM auth_token WHERE user_id = ?').run(userId);
			db.prepare('DELETE FROM user WHERE id = ?').run(userId);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
		return { removed: true };
	}
};
