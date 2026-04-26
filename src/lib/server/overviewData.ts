import { getDatabase } from '$lib/db/index.js';
import type { StatsDailyPoint } from '$lib/types/statsChart.js';
import { ensureValidTimeZone, localDateTimeToUtcIso, utcIsoToLocalDateTime } from '$lib/server/timezone.js';

type Db = ReturnType<typeof getDatabase>;

function sqliteIso(value: Date): string {
	return value.toISOString().slice(0, 19);
}

type OverviewStats = {
	totalPosts: number;
	draft: number;
	scheduled: number;
	sent: number;
	failed: number;
	scheduleCount: number;
	webhookCount: number;
};

type UpcomingPostRow = {
	id: string;
	title: string;
	scheduled_at: string;
	status: string;
	webhook_name: string;
};

type LastPublishedRow = {
	id: string;
	title: string;
	sent_at: string | null;
	webhook_name: string;
};

type FailedPostRow = {
	id: string;
	title: string;
	error_message: string | null;
	updated_at: string;
};

type PostWithFailedStageRow = {
	id: string;
	title: string;
	sent_at: string | null;
};

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

/** Map DB timestamp to local calendar date in `timeZone` (aligns with calendar naive + Z heuristic). */
function postTimestampToLocalDate(iso: string, timeZone: string): string | null {
	const normalized = iso.trim().replace(' ', 'T');
	const hasTz = /[zZ]$/.test(normalized) || /[+-]\d{2}:?\d{2}$/.test(normalized);
	const d = hasTz ? new Date(normalized) : new Date(`${normalized}Z`);
	if (Number.isNaN(d.getTime())) return null;
	return utcIsoToLocalDateTime(d.toISOString(), timeZone)?.date ?? null;
}

/**
 * Per-day counts for a calendar month in `timeZone`: posts sent that local day (`status=sent`),
 * and posts with `scheduled_at` falling on that local day (any status).
 */
export function loadMonthlyActivitySeries(
	db: Db,
	accountId: string,
	yearMonth: string,
	timeZone: string
): StatsDailyPoint[] {
	const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
	if (!m) return [];
	const y = Number(m[1]);
	const mo = Number(m[2]);
	if (!y || mo < 1 || mo > 12) return [];
	const tz = ensureValidTimeZone(timeZone);

	const startIso = localDateTimeToUtcIso(`${y}-${pad2(mo)}-01T00:00:00`, tz);
	const nextMo = mo === 12 ? 1 : mo + 1;
	const nextY = mo === 12 ? y + 1 : y;
	const endIso = localDateTimeToUtcIso(`${nextY}-${pad2(nextMo)}-01T00:00:00`, tz);
	if (!startIso || !endIso) return [];

	const daysInMonth = new Date(y, mo, 0).getDate();
	const keys: string[] = [];
	const sentByDay = new Map<string, number>();
	const schedByDay = new Map<string, number>();
	for (let d = 1; d <= daysInMonth; d++) {
		const key = `${y}-${pad2(mo)}-${pad2(d)}`;
		keys.push(key);
		sentByDay.set(key, 0);
		schedByDay.set(key, 0);
	}

	const sentRows = db
		.prepare(
			`SELECT sent_at FROM post WHERE account_id = ? AND status = 'sent' AND sent_at IS NOT NULL
       AND sent_at >= ? AND sent_at < ?`
		)
		.all(accountId, startIso, endIso) as { sent_at: string }[];

	for (const row of sentRows) {
		const day = postTimestampToLocalDate(row.sent_at, tz);
		if (day && sentByDay.has(day)) sentByDay.set(day, (sentByDay.get(day) ?? 0) + 1);
	}

	const schedRows = db
		.prepare(
			`SELECT scheduled_at FROM post WHERE account_id = ? AND scheduled_at IS NOT NULL
       AND scheduled_at >= ? AND scheduled_at < ?`
		)
		.all(accountId, startIso, endIso) as { scheduled_at: string }[];

	for (const row of schedRows) {
		const day = postTimestampToLocalDate(row.scheduled_at, tz);
		if (day && schedByDay.has(day)) schedByDay.set(day, (schedByDay.get(day) ?? 0) + 1);
	}

	return keys.map((date) => ({
		date,
		sent: sentByDay.get(date) ?? 0,
		scheduled: schedByDay.get(date) ?? 0
	}));
}

export function loadCalendarOverview(
	db: Db,
	accountId: string | null
): {
	stats: OverviewStats | null;
	sentThisWeek: number;
	stagePasses: number;
	stageFails: number;
} {
	if (!accountId) {
		return { stats: null, sentThisWeek: 0, stagePasses: 0, stageFails: 0 };
	}

	const now = sqliteIso(new Date());

	const statusRows = db
		.prepare(`SELECT status, COUNT(*) as count FROM post WHERE account_id = ? GROUP BY status`)
		.all(accountId) as { status: string; count: number }[];

	const counts = { draft: 0, scheduled: 0, sent: 0, failed: 0 };
	for (const row of statusRows) {
		if (row.status in counts) {
			counts[row.status as keyof typeof counts] = row.count;
		}
	}

	const totalPosts = counts.draft + counts.scheduled + counts.sent + counts.failed;
	const scheduleCount = (db.prepare('SELECT COUNT(*) as c FROM schedule WHERE account_id = ?').get(accountId) as { c: number }).c;
	const webhookCount = (db.prepare('SELECT COUNT(*) as c FROM webhook_config WHERE account_id = ?').get(accountId) as { c: number }).c;

	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - weekStart.getDay());
	weekStart.setHours(0, 0, 0, 0);
	const sentThisWeek = (
		db
			.prepare(`SELECT COUNT(*) as c FROM post WHERE account_id = ? AND status = 'sent' AND sent_at >= ?`)
			.get(accountId, sqliteIso(weekStart)) as { c: number }
	).c;

	const stageCountRows = db
		.prepare(
			`SELECT s.status, COUNT(*) as count FROM post_stage s JOIN post p ON p.id = s.post_id WHERE p.account_id = ? GROUP BY s.status`
		)
		.all(accountId) as { status: string; count: number }[];
	let stagePasses = 0;
	let stageFails = 0;
	for (const row of stageCountRows) {
		if (row.status === 'pass') stagePasses = row.count;
		else if (row.status === 'fail') stageFails = row.count;
	}

	return {
		stats: {
			totalPosts,
			draft: counts.draft,
			scheduled: counts.scheduled,
			sent: counts.sent,
			failed: counts.failed,
			scheduleCount,
			webhookCount
		},
		sentThisWeek,
		stagePasses,
		stageFails
	};
}

export function loadReportStatistics(
	db: Db,
	accountId: string | null
): {
	upcomingPosts: UpcomingPostRow[];
	lastPublishedPosts: LastPublishedRow[];
	failedPosts: FailedPostRow[];
	postsWithFailedStages: PostWithFailedStageRow[];
} {
	if (!accountId) {
		return {
			upcomingPosts: [],
			lastPublishedPosts: [],
			failedPosts: [],
			postsWithFailedStages: []
		};
	}

	const now = sqliteIso(new Date());

	const upcomingPosts = db
		.prepare(
			`SELECT p.id, p.title, p.scheduled_at, p.status, COALESCE(w.name, 'No webhook') as webhook_name
       FROM post p
       LEFT JOIN webhook_config w ON p.webhook_id = w.id
       WHERE p.account_id = ? AND p.scheduled_at IS NOT NULL AND p.scheduled_at >= ?
       ORDER BY p.scheduled_at ASC
       LIMIT 10`
		)
		.all(accountId, now) as UpcomingPostRow[];

	const lastPublishedPosts = db
		.prepare(
			`SELECT p.id, p.title, p.sent_at, COALESCE(w.name, 'No webhook') as webhook_name
       FROM post p
       LEFT JOIN webhook_config w ON p.webhook_id = w.id
       WHERE p.account_id = ? AND p.status = 'sent'
       ORDER BY p.sent_at DESC
       LIMIT 10`
		)
		.all(accountId) as LastPublishedRow[];

	const failedPosts = db
		.prepare(
			`SELECT id, title, error_message, updated_at FROM post
       WHERE account_id = ? AND status = 'failed'
       ORDER BY updated_at DESC`
		)
		.all(accountId) as FailedPostRow[];

	const postsWithFailedStages = db
		.prepare(
			`SELECT DISTINCT p.id, p.title, p.sent_at
       FROM post p
       JOIN post_stage s ON s.post_id = p.id
       WHERE p.account_id = ? AND s.status = 'fail'
       ORDER BY p.sent_at DESC, p.updated_at DESC`
		)
		.all(accountId) as PostWithFailedStageRow[];

	return {
		upcomingPosts,
		lastPublishedPosts,
		failedPosts,
		postsWithFailedStages
	};
}
