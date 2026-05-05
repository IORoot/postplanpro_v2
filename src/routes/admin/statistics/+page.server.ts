import { getDatabase } from '$lib/db/index.js';
import { requireAdmin } from '$lib/admin.js';
import type { PageServerLoad } from './$types';

const VALID_RANGES = [7, 30, 90, 180, 365] as const;
type RangeDays = (typeof VALID_RANGES)[number];

function parseRange(raw: string | null): RangeDays {
	const n = Number(raw);
	return (VALID_RANGES.includes(n as RangeDays) ? n : 30) as RangeDays;
}

function isoDay(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function buildDayBuckets(days: number): { dates: string[]; map: Map<string, number> } {
	const dates: string[] = [];
	const map = new Map<string, number>();
	const now = new Date();
	const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(end - i * 86_400_000);
		const key = isoDay(d);
		dates.push(key);
		map.set(key, 0);
	}
	return { dates, map };
}

type CountRow = { day: string; n: number };

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getDatabase();
	const range = parseRange(event.url.searchParams.get('range'));
	const sinceIso = new Date(Date.now() - range * 86_400_000).toISOString();

	const totalsRow = db
		.prepare(
			`SELECT
        (SELECT COUNT(*) FROM user) AS users,
        (SELECT COUNT(*) FROM user WHERE tier = 'free') AS users_free,
        (SELECT COUNT(*) FROM user WHERE tier = 'pro') AS users_pro,
        (SELECT COUNT(*) FROM user WHERE tier = 'enterprise') AS users_enterprise,
        (SELECT COUNT(*) FROM user WHERE tier = 'admin') AS users_admin,
        (SELECT COUNT(*) FROM user WHERE tier = 'blocked') AS users_blocked,
        (SELECT COUNT(*) FROM user WHERE email_verified_at IS NOT NULL) AS users_verified,
        (SELECT COUNT(*) FROM post) AS posts_total,
        (SELECT COUNT(*) FROM post WHERE status = 'sent') AS posts_sent,
        (SELECT COUNT(*) FROM post WHERE status = 'scheduled') AS posts_scheduled,
        (SELECT COUNT(*) FROM post WHERE status = 'failed') AS posts_failed,
        (SELECT COUNT(*) FROM post WHERE status = 'draft') AS posts_draft,
        (SELECT COUNT(*) FROM send_log) AS send_logs_total,
        (SELECT COUNT(*) FROM send_log WHERE success = 1) AS send_logs_success,
        (SELECT COUNT(*) FROM send_log WHERE success = 0) AS send_logs_failed,
        (SELECT COUNT(*) FROM webhook_config) AS webhooks_total,
        (SELECT COUNT(*) FROM schedule) AS schedules_total,
        (SELECT COUNT(*) FROM schedule_slot) AS schedule_slots_total,
        (SELECT COUNT(*) FROM schedule_rule) AS schedule_rules_total,
        (SELECT COUNT(*) FROM oauth_account) AS oauth_accounts_total,
        (SELECT COUNT(*) FROM auth_token) AS auth_tokens_total,
        (SELECT COALESCE(SUM(callback_inputs), 0) FROM usage_month) AS callback_inputs_total,
        (SELECT COALESCE(SUM(import_operations), 0) FROM usage_month) AS import_operations_total,
        (SELECT COUNT(*) FROM post_stage) AS post_stages_total,
        (SELECT COUNT(*) FROM post_stage WHERE status = 'pass') AS post_stages_pass,
        (SELECT COUNT(*) FROM post_stage WHERE status = 'fail') AS post_stages_fail`
		)
		.get() as Record<string, number>;

	const sinceTotalsRow = db
		.prepare(
			`SELECT
        (SELECT COUNT(*) FROM user WHERE created_at >= ?) AS new_users,
        (SELECT COUNT(*) FROM user WHERE last_login_at IS NOT NULL AND last_login_at >= ?) AS active_users,
        (SELECT COUNT(*) FROM post WHERE created_at >= ?) AS posts_created,
        (SELECT COUNT(*) FROM send_log WHERE sent_at >= ?) AS send_attempts,
        (SELECT COUNT(*) FROM send_log WHERE success = 1 AND sent_at >= ?) AS send_successes,
        (SELECT COUNT(*) FROM send_log WHERE success = 0 AND sent_at >= ?) AS send_failures`
		)
		.get(sinceIso, sinceIso, sinceIso, sinceIso, sinceIso, sinceIso) as {
			new_users: number;
			active_users: number;
			posts_created: number;
			send_attempts: number;
			send_successes: number;
			send_failures: number;
		};

	const buckets = buildDayBuckets(range);

	const postsCreatedRows = db
		.prepare(
			`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM post
       WHERE created_at >= ?
       GROUP BY day
       ORDER BY day`
		)
		.all(sinceIso) as CountRow[];
	const postsScheduledRows = db
		.prepare(
			`SELECT substr(scheduled_at, 1, 10) AS day, COUNT(*) AS n
       FROM post
       WHERE scheduled_at IS NOT NULL AND scheduled_at >= ?
       GROUP BY day
       ORDER BY day`
		)
		.all(sinceIso) as CountRow[];
	const sendsSuccessRows = db
		.prepare(
			`SELECT substr(sent_at, 1, 10) AS day, COUNT(*) AS n
       FROM send_log
       WHERE success = 1 AND sent_at >= ?
       GROUP BY day
       ORDER BY day`
		)
		.all(sinceIso) as CountRow[];
	const sendsFailedRows = db
		.prepare(
			`SELECT substr(sent_at, 1, 10) AS day, COUNT(*) AS n
       FROM send_log
       WHERE success = 0 AND sent_at >= ?
       GROUP BY day
       ORDER BY day`
		)
		.all(sinceIso) as CountRow[];
	const newUsersRows = db
		.prepare(
			`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM user
       WHERE created_at >= ?
       GROUP BY day
       ORDER BY day`
		)
		.all(sinceIso) as CountRow[];

	function fillSeries(rows: CountRow[]): number[] {
		const map = new Map(buckets.map);
		for (const r of rows) {
			if (!r.day) continue;
			if (map.has(r.day)) map.set(r.day, r.n);
		}
		return buckets.dates.map((d) => map.get(d) ?? 0);
	}

	const series = {
		dates: buckets.dates,
		postsCreated: fillSeries(postsCreatedRows),
		postsScheduled: fillSeries(postsScheduledRows),
		sendsSuccess: fillSeries(sendsSuccessRows),
		sendsFailed: fillSeries(sendsFailedRows),
		newUsers: fillSeries(newUsersRows)
	};

	const tierBreakdown = [
		{ tier: 'free', count: totalsRow.users_free },
		{ tier: 'pro', count: totalsRow.users_pro },
		{ tier: 'enterprise', count: totalsRow.users_enterprise },
		{ tier: 'admin', count: totalsRow.users_admin },
		{ tier: 'blocked', count: totalsRow.users_blocked }
	];

	const topUsersByPosts = db
		.prepare(
			`SELECT u.id, u.email, u.name, u.tier, COUNT(p.id) AS post_count
       FROM user u
       LEFT JOIN post p ON p.account_id = u.id
       GROUP BY u.id
       ORDER BY post_count DESC
       LIMIT 10`
		)
		.all() as { id: string; email: string | null; name: string | null; tier: string; post_count: number }[];

	const topUsersBySends = db
		.prepare(
			`SELECT u.id, u.email, u.name, u.tier, COUNT(s.id) AS send_count
       FROM user u
       LEFT JOIN send_log s ON s.account_id = u.id AND s.success = 1
       GROUP BY u.id
       ORDER BY send_count DESC
       LIMIT 10`
		)
		.all() as { id: string; email: string | null; name: string | null; tier: string; send_count: number }[];

	const recentFailuresRow = db
		.prepare(
			`SELECT response_status AS status, COUNT(*) AS n
       FROM send_log
       WHERE success = 0 AND sent_at >= ?
       GROUP BY response_status
       ORDER BY n DESC
       LIMIT 10`
		)
		.all(sinceIso) as { status: number | null; n: number }[];

	const successRate =
		sinceTotalsRow.send_attempts > 0
			? sinceTotalsRow.send_successes / sinceTotalsRow.send_attempts
			: null;

	return {
		range,
		generatedAt: new Date().toISOString(),
		totals: totalsRow,
		sinceTotals: { ...sinceTotalsRow, success_rate: successRate },
		series,
		tierBreakdown,
		topUsersByPosts,
		topUsersBySends,
		recentFailures: recentFailuresRow
	};
};
