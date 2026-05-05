import { getDatabase } from '$lib/db/index.js';
import { currentMonthKey } from '$lib/usage.js';
import { mergeAccountUsageIntoEmailCarryover, normalizeQuotaEmail } from '$lib/server/emailQuotaCarryover.js';
import { requireAdmin } from '$lib/admin.js';
import { fail } from '@sveltejs/kit';
import { getTierLimits } from '$lib/tiers.js';
import type { Actions, PageServerLoad } from './$types';

const VALID_TIERS = ['free', 'pro', 'enterprise', 'admin', 'blocked'] as const;
const VALID_PAGE_SIZES = [20, 50, 100, 200] as const;
type PageSize = (typeof VALID_PAGE_SIZES)[number];
const SORT_FIELDS = [
	'user',
	'tier',
	'joined',
	'posts',
	'callbacks',
	'imports',
	'postCount',
	'scheduleCount',
	'webhookCount'
] as const;
type SortField = (typeof SORT_FIELDS)[number];
type SortDir = 'asc' | 'desc';

function parsePageSize(raw: string | null): PageSize {
	const n = Number(raw);
	return (VALID_PAGE_SIZES.includes(n as PageSize) ? n : 50) as PageSize;
}

function parsePage(raw: string | null): number {
	const n = Number(raw);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseSortField(raw: string | null): SortField {
	return (SORT_FIELDS.includes((raw ?? '') as SortField) ? raw : 'joined') as SortField;
}

function parseSortDir(raw: string | null): SortDir {
	return raw === 'asc' ? 'asc' : 'desc';
}

function parseNullableInt(raw: string | null): number | null {
	if (raw == null || raw.trim() === '') return null;
	const n = Number(raw);
	if (!Number.isFinite(n)) return null;
	return Math.floor(n);
}

function orderByFor(sort: SortField, dir: SortDir): string {
	const direction = dir === 'asc' ? 'ASC' : 'DESC';
	switch (sort) {
		case 'user':
			return `sort_user ${direction}, id ASC`;
		case 'tier':
			return `tier ${direction}, id ASC`;
		case 'joined':
			return `created_at ${direction}, id ASC`;
		case 'posts':
			return `usage_posts_total ${direction}, id ASC`;
		case 'callbacks':
			return `usage_callback_inputs ${direction}, id ASC`;
		case 'imports':
			return `usage_import_operations ${direction}, id ASC`;
		case 'postCount':
			return `post_count ${direction}, id ASC`;
		case 'scheduleCount':
			return `schedule_count ${direction}, id ASC`;
		case 'webhookCount':
			return `webhook_count ${direction}, id ASC`;
		default:
			return `created_at DESC, id ASC`;
	}
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getDatabase();
	const month = currentMonthKey();
	const page = parsePage(event.url.searchParams.get('page'));
	const pageSize = parsePageSize(event.url.searchParams.get('pageSize'));
	const sort = parseSortField(event.url.searchParams.get('sort'));
	const dir = parseSortDir(event.url.searchParams.get('dir'));
	const q = (event.url.searchParams.get('q') ?? '').trim().toLowerCase();
	const tier = (event.url.searchParams.get('tier') ?? '').trim().toLowerCase();
	const joinedFrom = (event.url.searchParams.get('joinedFrom') ?? '').trim();
	const joinedTo = (event.url.searchParams.get('joinedTo') ?? '').trim();
	const postsMin = parseNullableInt(event.url.searchParams.get('postsMin'));
	const postsMax = parseNullableInt(event.url.searchParams.get('postsMax'));
	const callbacksMin = parseNullableInt(event.url.searchParams.get('callbacksMin'));
	const callbacksMax = parseNullableInt(event.url.searchParams.get('callbacksMax'));
	const importsMin = parseNullableInt(event.url.searchParams.get('importsMin'));
	const importsMax = parseNullableInt(event.url.searchParams.get('importsMax'));
	const postCountMin = parseNullableInt(event.url.searchParams.get('postCountMin'));
	const postCountMax = parseNullableInt(event.url.searchParams.get('postCountMax'));
	const scheduleCountMin = parseNullableInt(event.url.searchParams.get('scheduleCountMin'));
	const scheduleCountMax = parseNullableInt(event.url.searchParams.get('scheduleCountMax'));
	const webhookCountMin = parseNullableInt(event.url.searchParams.get('webhookCountMin'));
	const webhookCountMax = parseNullableInt(event.url.searchParams.get('webhookCountMax'));
	const whereClauses: string[] = [];
	const whereParams: (string | number)[] = [];
	if (q) {
		whereClauses.push('(lower(id) LIKE ? OR lower(coalesce(email, \'\')) LIKE ? OR lower(coalesce(name, \'\')) LIKE ?)');
		const like = `%${q}%`;
		whereParams.push(like, like, like);
	}
	if (tier) {
		whereClauses.push('tier = ?');
		whereParams.push(tier);
	}
	if (joinedFrom) {
		whereClauses.push("substr(created_at, 1, 10) >= ?");
		whereParams.push(joinedFrom);
	}
	if (joinedTo) {
		whereClauses.push("substr(created_at, 1, 10) <= ?");
		whereParams.push(joinedTo);
	}
	if (postsMin != null) {
		whereClauses.push('usage_posts_total >= ?');
		whereParams.push(postsMin);
	}
	if (postsMax != null) {
		whereClauses.push('usage_posts_total <= ?');
		whereParams.push(postsMax);
	}
	if (callbacksMin != null) {
		whereClauses.push('usage_callback_inputs >= ?');
		whereParams.push(callbacksMin);
	}
	if (callbacksMax != null) {
		whereClauses.push('usage_callback_inputs <= ?');
		whereParams.push(callbacksMax);
	}
	if (importsMin != null) {
		whereClauses.push('usage_import_operations >= ?');
		whereParams.push(importsMin);
	}
	if (importsMax != null) {
		whereClauses.push('usage_import_operations <= ?');
		whereParams.push(importsMax);
	}
	if (postCountMin != null) {
		whereClauses.push('post_count >= ?');
		whereParams.push(postCountMin);
	}
	if (postCountMax != null) {
		whereClauses.push('post_count <= ?');
		whereParams.push(postCountMax);
	}
	if (scheduleCountMin != null) {
		whereClauses.push('schedule_count >= ?');
		whereParams.push(scheduleCountMin);
	}
	if (scheduleCountMax != null) {
		whereClauses.push('schedule_count <= ?');
		whereParams.push(scheduleCountMax);
	}
	if (webhookCountMin != null) {
		whereClauses.push('webhook_count >= ?');
		whereParams.push(webhookCountMin);
	}
	if (webhookCountMax != null) {
		whereClauses.push('webhook_count <= ?');
		whereParams.push(webhookCountMax);
	}
	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const baseSql = `
    WITH
      send_counts AS (
        SELECT account_id, COUNT(*) AS c
        FROM send_log
        WHERE success = 1 AND strftime('%Y-%m', sent_at) = ?
        GROUP BY account_id
      ),
      queued_counts AS (
        SELECT account_id, COUNT(*) AS c
        FROM post
        WHERE scheduled_at IS NOT NULL
          AND strftime('%Y-%m', scheduled_at) = ?
          AND status IN ('scheduled', 'failed')
        GROUP BY account_id
      ),
      post_counts AS (
        SELECT account_id, COUNT(*) AS c FROM post GROUP BY account_id
      ),
      schedule_counts AS (
        SELECT account_id, COUNT(*) AS c FROM schedule GROUP BY account_id
      ),
      webhook_counts AS (
        SELECT account_id, COUNT(*) AS c FROM webhook_config GROUP BY account_id
      )
    SELECT
      u.id,
      u.email,
      u.name,
      u.tier,
      u.created_at,
      u.last_login_at,
      u.email_verified_at,
      u.timezone,
      u.stripe_customer_id,
      u.stripe_subscription_id,
      coalesce(pc.c, 0) AS post_count,
      coalesce(sc.c, 0) AS schedule_count,
      coalesce(wc.c, 0) AS webhook_count,
      coalesce(send_counts.c, 0) AS post_sends_from_log,
      coalesce(qc.c, 0) AS posts_queued,
      coalesce(um.callback_inputs, 0) + coalesce(eq.callback_inputs, 0) AS usage_callback_inputs,
      coalesce(um.import_operations, 0) + coalesce(eq.import_operations, 0) AS usage_import_operations,
      coalesce(um.post_sends_override, coalesce(send_counts.c, 0)) + coalesce(eq.output_sends, 0) AS usage_posts_total,
      coalesce(um.callback_inputs, 0) AS usage_callback_inputs_account,
      coalesce(um.import_operations, 0) AS usage_import_operations_account,
      coalesce(um.post_sends_override, NULL) AS usage_post_override,
      lower(coalesce(u.email, u.name, u.id)) AS sort_user
    FROM user u
    LEFT JOIN post_counts pc ON pc.account_id = u.id
    LEFT JOIN schedule_counts sc ON sc.account_id = u.id
    LEFT JOIN webhook_counts wc ON wc.account_id = u.id
    LEFT JOIN send_counts ON send_counts.account_id = u.id
    LEFT JOIN queued_counts qc ON qc.account_id = u.id
    LEFT JOIN usage_month um ON um.account_id = u.id AND um.month = ?
    LEFT JOIN email_quota_carryover_month eq ON eq.email_norm = lower(trim(coalesce(u.email, ''))) AND eq.month = ?
  `;
	const commonParams: (string | number)[] = [month, month, month, month];

	const total =
		(db
			.prepare(`SELECT COUNT(*) AS n FROM (${baseSql}) user_base ${whereSql}`)
			.get(...commonParams, ...whereParams) as { n: number } | undefined)?.n ?? 0;
	const offset = (page - 1) * pageSize;
	const orderBy = orderByFor(sort, dir);
	const rows = db
		.prepare(`${baseSql} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
		.all(...commonParams, ...whereParams, pageSize, offset) as {
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
		post_sends_from_log: number;
		posts_queued: number;
		usage_callback_inputs: number;
		usage_import_operations: number;
		usage_posts_total: number;
		usage_callback_inputs_account: number;
		usage_import_operations_account: number;
		usage_post_override: number | null;
	}[];

	const paged = rows.map((u) => {
		const limits = getTierLimits(u.tier);
		return {
			...u,
			postSendsFromLog: u.post_sends_from_log,
			usage: {
				postsTotal: u.usage_posts_total,
				postsQueued: u.posts_queued,
				callbackInputs: u.usage_callback_inputs,
				importOperations: u.usage_import_operations
			},
			usageMonthAccount: {
				callback_inputs: u.usage_callback_inputs_account,
				import_operations: u.usage_import_operations_account,
				post_sends_override: u.usage_post_override
			},
			limits: {
				posts: limits.postsSentPerMonth,
				callbacks: limits.callbackInputsPerMonth,
				imports: limits.importOperationsPerMonth
			}
		};
	});

	return {
		users: paged,
		usageMonthKey: month,
		page,
		pageSize,
		total,
		filters: {
			q,
			tier,
			joinedFrom,
			joinedTo,
			postsMin,
			postsMax,
			callbacksMin,
			callbacksMax,
			importsMin,
			importsMax,
			postCountMin,
			postCountMax,
			scheduleCountMin,
			scheduleCountMax,
			webhookCountMin,
			webhookCountMax,
			sort,
			dir
		},
		sortOptions: SORT_FIELDS
	};
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
