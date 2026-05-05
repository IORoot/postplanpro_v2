import { getDatabase } from '$lib/db/index.js';
import {
	loadCalendarOverview,
	loadMonthlyActivitySeries,
	loadReportStatistics
} from '$lib/server/overviewData.js';
import { ensureValidTimeZone, localDateTimeToUtcIso, utcIsoToLocalDateTime } from '$lib/server/timezone.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CALLBACK_ORDER_COLS = ['title', 'stage', 'status', 'date'] as const;
type CallbackOrderCol = (typeof CALLBACK_ORDER_COLS)[number];
const PAGED_SIZES = [20, 50, 100, 200] as const;
type PageSize = (typeof PAGED_SIZES)[number];

function shiftYearMonth(yearMonth: string, delta: number): string {
	const [ys, ms] = yearMonth.split('-');
	const y = Number(ys);
	const mo = Number(ms);
	const d = new Date(y, mo - 1 + delta, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYearMonthInTimezone(timeZone: string): string {
	const local = utcIsoToLocalDateTime(new Date().toISOString(), ensureValidTimeZone(timeZone));
	return local?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
}

function parseStatsMonthParam(raw: string | null, timeZone: string): string {
	const tz = ensureValidTimeZone(timeZone);
	if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return currentYearMonthInTimezone(tz);
	const [y, m] = raw.split('-').map(Number);
	if (!y || m < 1 || m > 12 || y < 2000 || y > 2100) return currentYearMonthInTimezone(tz);
	return `${y}-${String(m).padStart(2, '0')}`;
}

function statsMonthLongLabel(yearMonth: string, timeZone: string): string {
	const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
	if (!m) return yearMonth;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const iso = localDateTimeToUtcIso(`${y}-${m[2]}-15T12:00:00`, ensureValidTimeZone(timeZone));
	if (!iso) return yearMonth;
	return new Intl.DateTimeFormat(undefined, {
		timeZone: ensureValidTimeZone(timeZone),
		month: 'long',
		year: 'numeric'
	}).format(new Date(iso));
}

function parseReportType(url: URL): 'logs' | 'callback-stages' | 'statistics' {
	const r = url.searchParams.get('report');
	if (r === 'callback-stages') return 'callback-stages';
	if (r === 'statistics') return 'statistics';
	return 'logs';
}

function parsePositiveInt(raw: string | null, fallback: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(1, Math.floor(n));
}

function parsePageSize(raw: string | null): PageSize {
	const n = Number(raw);
	return (PAGED_SIZES.includes(n as PageSize) ? n : 50) as PageSize;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const reportType = parseReportType(url);
	const accountId = locals.userId;
	if (!accountId)
		return {
			reports: [],
			reportType,
			callbackStages: [],
			callbackOrderBy: 'date',
			callbackOrderDir: 'desc',
			callbackFilters: { title: '', stage: '', status: '' },
			upcomingPosts: [],
			lastPublishedPosts: [],
			failedPosts: [],
			postsWithFailedStages: [],
			stats: null,
			sentThisWeek: 0,
			stagePasses: 0,
			stageFails: 0,
			timezone: ensureValidTimeZone(null),
			statsChartMonth: '',
			statsChartSeries: [],
			statsChartTitle: '',
			statsChartPrevMonth: '',
			statsChartNextMonth: ''
		};

	const db = getDatabase();
	const user = db.prepare('SELECT timezone FROM user WHERE id = ?').get(accountId) as
		| { timezone: string | null }
		| undefined;
	const timezone = ensureValidTimeZone(user?.timezone);
	const statistics =
		reportType === 'statistics'
			? loadReportStatistics(db, accountId)
			: {
					upcomingPosts: [],
					lastPublishedPosts: [],
					failedPosts: [],
					postsWithFailedStages: []
				};

	const overview =
		reportType === 'statistics'
			? loadCalendarOverview(db, accountId)
			: { stats: null, sentThisWeek: 0, stagePasses: 0, stageFails: 0 };

	let statsChartMonth = '';
	let statsChartSeries: ReturnType<typeof loadMonthlyActivitySeries> = [];
	let statsChartTitle = '';
	let statsChartPrevMonth = '';
	let statsChartNextMonth = '';
	if (reportType === 'statistics') {
		statsChartMonth = parseStatsMonthParam(url.searchParams.get('statsMonth'), timezone);
		statsChartSeries = loadMonthlyActivitySeries(db, accountId, statsChartMonth, timezone);
		statsChartTitle = statsMonthLongLabel(statsChartMonth, timezone);
		statsChartPrevMonth = shiftYearMonth(statsChartMonth, -1);
		statsChartNextMonth = shiftYearMonth(statsChartMonth, 1);
	}

	let logsPageSize: PageSize = 20;
	let logsPage = 1;
	let logsTotal = 0;
	let logsTotalPages = 1;
	const reports =
		reportType === 'logs'
			? (() => {
					logsPageSize = parsePageSize(url.searchParams.get('pageSize'));
					logsPage = parsePositiveInt(url.searchParams.get('page'), 1);
					const countRow = db
						.prepare('SELECT COUNT(*) as count FROM send_log WHERE account_id = ?')
						.get(accountId) as { count: number } | undefined;
					logsTotal = Number(countRow?.count ?? 0);
					logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));
					logsPage = Math.min(logsPage, logsTotalPages);
					const offset = (logsPage - 1) * logsPageSize;
					return db
						.prepare(
							`SELECT l.id, l.post_id, l.sent_at, l.request_json, l.response_status, l.response_body, l.success,
        p.title as post_title,
        COALESCE(w.name, 'No webhook') as webhook_name
     FROM send_log l
     JOIN post p ON p.id = l.post_id
     LEFT JOIN webhook_config w ON w.id = p.webhook_id
     WHERE l.account_id = ?
     ORDER BY l.sent_at DESC
     LIMIT ? OFFSET ?`
						)
						.all(accountId, logsPageSize, offset) as {
						id: string;
						post_id: string;
						sent_at: string;
						request_json: string;
						response_status: number | null;
						response_body: string | null;
						success: number;
						post_title: string;
						webhook_name: string;
					}[];
				})()
			: [];

	let callbackStages: { post_id: string; post_title: string; stage: string; status: string; completed_at: string }[] = [];
	let callbackOrderBy = 'date';
	let callbackOrderDir: 'asc' | 'desc' = 'desc';
	let callbackPage = 1;
	let callbackPageSize: PageSize = 50;
	let callbackTotal = 0;
	let callbackTotalPages = 1;
	const filterTitle = (url.searchParams.get('filterTitle') ?? '').trim();
	const filterStage = (url.searchParams.get('filterStage') ?? '').trim();
	const filterStatus = (url.searchParams.get('filterStatus') ?? '').trim();
	const orderByParam = url.searchParams.get('orderBy');
	const orderDirParam = url.searchParams.get('orderDir');

	if (reportType === 'callback-stages') {
		callbackOrderBy =
			orderByParam && CALLBACK_ORDER_COLS.includes(orderByParam as CallbackOrderCol) ? orderByParam : 'date';
		callbackOrderDir = orderDirParam === 'asc' ? 'asc' : 'desc';
		callbackPage = parsePositiveInt(url.searchParams.get('page'), 1);
		callbackPageSize = parsePageSize(url.searchParams.get('pageSize'));

		const baseSql = `
      SELECT s.post_id, p.title as post_title, s.stage, s.status, s.completed_at
      FROM post_stage s
      JOIN post p ON p.id = s.post_id
      WHERE p.account_id = ?
    `;
		const conditions: string[] = [];
		const params: (string | number)[] = [accountId];
		if (filterTitle) {
			conditions.push('p.title LIKE ?');
			params.push(`%${filterTitle}%`);
		}
		if (filterStage) {
			conditions.push('s.stage = ?');
			params.push(filterStage);
		}
		if (filterStatus) {
			conditions.push('s.status = ?');
			params.push(filterStatus);
		}
		const where = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
		const orderCol =
			callbackOrderBy === 'title'
				? 'p.title'
				: callbackOrderBy === 'stage'
					? 's.stage'
					: callbackOrderBy === 'status'
						? 's.status'
						: 's.completed_at';
		const orderSql = `ORDER BY ${orderCol} ${callbackOrderDir.toUpperCase()}`;
		const countRow = db
			.prepare(`SELECT COUNT(*) as count FROM post_stage s JOIN post p ON p.id = s.post_id WHERE p.account_id = ?${where}`)
			.get(...params) as { count: number } | undefined;
		callbackTotal = Number(countRow?.count ?? 0);
		callbackTotalPages = Math.max(1, Math.ceil(callbackTotal / callbackPageSize));
		callbackPage = Math.min(callbackPage, callbackTotalPages);
		const offset = (callbackPage - 1) * callbackPageSize;
		callbackStages = db
			.prepare(`${baseSql}${where} ${orderSql} LIMIT ? OFFSET ?`)
			.all(...params, callbackPageSize, offset) as { post_id: string; post_title: string; stage: string; status: string; completed_at: string }[];
	}

	return {
		reports,
		timezone,
		reportType,
		callbackStages,
		callbackOrderBy,
		callbackOrderDir,
		callbackPage,
		callbackPageSize,
		callbackTotal,
		callbackTotalPages,
		callbackFilters: { title: filterTitle, stage: filterStage, status: filterStatus },
		statsChartMonth,
		statsChartSeries,
		statsChartTitle,
		statsChartPrevMonth,
		statsChartNextMonth,
		logsPage,
		logsPageSize,
		logsTotal,
		logsTotalPages,
		...statistics,
		...overview
	};
};

export const actions: Actions = {
	clearLogs: async ({ locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		getDatabase().prepare('DELETE FROM send_log WHERE account_id = ?').run(accountId);
		return { success: true };
	},
	deleteReport: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM send_log WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	}
};
