import { getDatabase } from '$lib/db/index.js';
import {
	currentMonthKey,
	getUsageForMonth,
	getUsageMonthAccountRow
} from '$lib/usage.js';
import { mergeAccountUsageIntoEmailCarryover, normalizeQuotaEmail } from '$lib/server/emailQuotaCarryover.js';
import { requireAdmin } from '$lib/admin.js';
import { fail } from '@sveltejs/kit';
import { getTierLimits } from '$lib/tiers.js';
import type { Actions, PageServerLoad } from './$types';

const VALID_TIERS = ['free', 'pro', 'enterprise', 'admin', 'blocked'] as const;

function countSendLogSuccessForMonth(
	db: ReturnType<typeof getDatabase>,
	accountId: string,
	month: string
): number {
	return (
		db
			.prepare(
				`SELECT COUNT(*) as n FROM send_log
         WHERE account_id = ? AND success = 1 AND strftime('%Y-%m', sent_at) = ?`
			)
			.get(accountId, month) as { n: number }
	).n;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getDatabase();
	const month = currentMonthKey();
	const users = db
		.prepare(
			`SELECT u.id, u.email, u.name, u.tier, u.created_at, u.last_login_at, u.email_verified_at, u.timezone,
            u.stripe_customer_id, u.stripe_subscription_id,
            (SELECT COUNT(*) FROM post WHERE account_id = u.id) AS post_count,
            (SELECT COUNT(*) FROM schedule WHERE account_id = u.id) AS schedule_count,
            (SELECT COUNT(*) FROM webhook_config WHERE account_id = u.id) AS webhook_count
       FROM user u ORDER BY u.created_at ASC`
		)
		.all() as {
			id: string;
			email: string | null;
			name: string | null;
			tier: string;
			created_at: string;
			last_login_at: string | null;
			email_verified_at: string | null;
			timezone: string | null;
			stripe_customer_id: string | null;
			stripe_subscription_id: string | null;
			post_count: number;
			schedule_count: number;
			webhook_count: number;
		}[];
	const usersWithUsage = users.map((u) => {
		const usage = getUsageForMonth(db, u.id, month);
		const usageMonth = getUsageMonthAccountRow(db, u.id, month);
		const postSendsFromLog = countSendLogSuccessForMonth(db, u.id, month);
		const limits = getTierLimits(u.tier);
		return {
			...u,
			usage: {
				postsTotal: usage.postOutputSends,
				postsQueued: usage.postsQueuedForSend,
				callbackInputs: usage.callbackInputs,
				importOperations: usage.importOperations
			},
			usageMonthAccount: usageMonth,
			postSendsFromLog,
			limits: {
				posts: limits.postsSentPerMonth,
				callbacks: limits.callbackInputsPerMonth,
				imports: limits.importOperationsPerMonth
			}
		};
	});
	return { users: usersWithUsage, usageMonthKey: month };
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

	setUsage: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = (data.get('user_id') as string)?.trim();
		const month = ((data.get('month') as string) || '').trim() || currentMonthKey();
		if (!userId) {
			return fail(400, { error: 'Missing user_id.' });
		}
		const db = getDatabase();
		const exists = db.prepare('SELECT 1 FROM user WHERE id = ?').get(userId);
		if (!exists) {
			return fail(404, { error: 'User not found.' });
		}
		const cbRaw = data.get('callback_inputs');
		const impRaw = data.get('import_operations');
		const cb = parseInt(String(cbRaw ?? ''), 10);
		const imp = parseInt(String(impRaw ?? ''), 10);
		if (!Number.isFinite(cb) || cb < 0 || !Number.isFinite(imp) || imp < 0) {
			return fail(400, { error: 'Callback and import counts must be non-negative integers.' });
		}
		/** Blank = use successful send_log count for quota; non-negative integer = fixed override. */
		const postRaw = String(data.get('post_sends_override') ?? '').trim();
		let postOverride: number | null;
		if (postRaw === '') {
			postOverride = null;
		} else {
			const p = parseInt(postRaw, 10);
			if (!Number.isFinite(p) || p < 0 || String(p) !== postRaw) {
				return fail(400, { error: 'Post quota: enter a non-negative whole number, or leave blank to use send log count.' });
			}
			postOverride = p;
		}
		db.prepare(
			`INSERT INTO usage_month (account_id, month, callback_inputs, import_operations, post_sends_override)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id, month) DO UPDATE SET
         callback_inputs = excluded.callback_inputs,
         import_operations = excluded.import_operations,
         post_sends_override = excluded.post_sends_override`
		).run(userId, month, cb, imp, postOverride);
		return { updatedUsage: true };
	},

	removeUser: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = (data.get('user_id') as string)?.trim();
		if (!userId) {
			return fail(400, { error: 'Missing user_id.' });
		}
		const db = getDatabase();
		const target = db.prepare('SELECT id, tier, email FROM user WHERE id = ?').get(userId) as
			| { id: string; tier: string; email: string | null }
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
			mergeAccountUsageIntoEmailCarryover(db, userId, normalizeQuotaEmail(target.email));
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
