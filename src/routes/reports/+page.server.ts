import { getDatabase } from '$lib/db/index.js';
import { loadReportStatistics } from '$lib/server/overviewData.js';
import { ensureValidTimeZone } from '$lib/server/timezone.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CALLBACK_ORDER_COLS = ['title', 'stage', 'status', 'date'] as const;
type CallbackOrderCol = (typeof CALLBACK_ORDER_COLS)[number];

function parseReportType(url: URL): 'logs' | 'callback-stages' | 'statistics' {
	const r = url.searchParams.get('report');
	if (r === 'callback-stages') return 'callback-stages';
	if (r === 'statistics') return 'statistics';
	return 'logs';
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
			postsWithFailedStages: []
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

	const reports =
		reportType === 'logs'
			? (db
					.prepare(
						`SELECT l.id, l.post_id, l.sent_at, l.request_json, l.response_status, l.response_body, l.success,
        p.title as post_title,
        w.name as webhook_name
     FROM send_log l
     JOIN post p ON p.id = l.post_id
     JOIN webhook_config w ON w.id = p.webhook_id
     WHERE l.account_id = ?
     ORDER BY l.sent_at DESC`
					)
					.all(accountId) as {
					id: string;
					post_id: string;
					sent_at: string;
					request_json: string;
					response_status: number | null;
					response_body: string | null;
					success: number;
					post_title: string;
					webhook_name: string;
				}[])
			: [];

	let callbackStages: { post_id: string; post_title: string; stage: string; status: string; completed_at: string }[] = [];
	let callbackOrderBy = 'date';
	let callbackOrderDir: 'asc' | 'desc' = 'desc';
	const filterTitle = (url.searchParams.get('filterTitle') ?? '').trim();
	const filterStage = (url.searchParams.get('filterStage') ?? '').trim();
	const filterStatus = (url.searchParams.get('filterStatus') ?? '').trim();
	const orderByParam = url.searchParams.get('orderBy');
	const orderDirParam = url.searchParams.get('orderDir');

	if (reportType === 'callback-stages') {
		callbackOrderBy =
			orderByParam && CALLBACK_ORDER_COLS.includes(orderByParam as CallbackOrderCol) ? orderByParam : 'date';
		callbackOrderDir = orderDirParam === 'asc' ? 'asc' : 'desc';

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
		callbackStages = db
			.prepare(`${baseSql}${where} ${orderSql}`)
			.all(...params) as { post_id: string; post_title: string; stage: string; status: string; completed_at: string }[];
	}

	return {
		reports,
		timezone,
		reportType,
		callbackStages,
		callbackOrderBy,
		callbackOrderDir,
		callbackFilters: { title: filterTitle, stage: filterStage, status: filterStatus },
		...statistics
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
