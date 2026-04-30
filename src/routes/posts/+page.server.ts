import { getDatabase } from '$lib/db/index.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { ensureValidTimeZone } from '$lib/server/timezone.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const VALID_PAGE_SIZES = [20, 50, 100, 200] as const;
type PageSize = (typeof VALID_PAGE_SIZES)[number];

function parsePageSize(raw: string | null): PageSize {
	const n = Number(raw);
	return (VALID_PAGE_SIZES.includes(n as PageSize) ? n : 50) as PageSize;
}

function parsePage(raw: string | null): number {
	const n = Number(raw);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function buildWhereClause(
	status: string,
	webhookId: string,
	scheduled: string
): { clause: string; params: (string | number)[] } {
	let clause = '';
	const params: (string | number)[] = [];
	if (status && ['draft', 'scheduled', 'sent', 'failed'].includes(status)) {
		clause += ' AND p.status = ?';
		params.push(status);
	}
	if (webhookId) {
		clause += ' AND (p.webhook_id = ? OR EXISTS (SELECT 1 FROM post_webhook pw WHERE pw.post_id = p.id AND pw.webhook_id = ?))';
		params.push(webhookId, webhookId);
	}
	if (scheduled === 'yes') {
		clause += ' AND p.scheduled_at IS NOT NULL';
	} else if (scheduled === 'no') {
		clause += ' AND p.scheduled_at IS NULL';
	}
	return { clause, params };
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { posts: [], webhooks: [], schedules: [], filters: { status: '', webhookId: '', scheduled: '' }, page: 1, pageSize: 50 as PageSize, total: 0 };
	const db = getDatabase();
	const status = url.searchParams.get('status') ?? '';
	const webhookId = url.searchParams.get('webhook') ?? '';
	const scheduled = url.searchParams.get('scheduled') ?? ''; // 'yes' | 'no' | ''
	const pageSize = parsePageSize(url.searchParams.get('pageSize'));
	const page = parsePage(url.searchParams.get('page'));
	const offset = (page - 1) * pageSize;

	const { clause, params: filterParams } = buildWhereClause(status, webhookId, scheduled);

	const countSql = `SELECT COUNT(*) AS total FROM post p WHERE p.account_id = ?${clause}`;
	const { total } = db.prepare(countSql).get(accountId, ...filterParams) as { total: number };

	const sql = `
		SELECT p.id, p.webhook_id, p.schedule_id, p.title, p.content, p.image_url, p.color, p.scheduled_at, p.status, p.sent_at, p.created_at,
			COALESCE(w.name, 'No webhook') as webhook_name,
			CASE WHEN p.webhook_id IS NOT NULL OR EXISTS (SELECT 1 FROM post_webhook pw WHERE pw.post_id = p.id) THEN 1 ELSE 0 END as has_output_webhook
		FROM post p
		LEFT JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.account_id = ?${clause}
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`;

	const posts = db.prepare(sql).all(accountId, ...filterParams, pageSize, offset) as {
		id: string;
		webhook_id: string | null;
		schedule_id: string | null;
		title: string;
		content: string | null;
		image_url: string | null;
		color: string | null;
		scheduled_at: string | null;
		status: string;
		sent_at: string | null;
		created_at: string;
		webhook_name: string;
		has_output_webhook: number;
	}[];

	const webhooks = db.prepare('SELECT id, name FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const user = db.prepare('SELECT timezone FROM user WHERE id = ?').get(accountId) as { timezone: string | null } | undefined;
	const timezone = ensureValidTimeZone(user?.timezone);

	return { posts, webhooks, schedules, timezone, filters: { status, webhookId, scheduled }, page, pageSize, total };
};

function getIds(formData: FormData): string[] {
	const ids = formData.getAll('ids');
	return Array.isArray(ids) ? (ids as string[]).filter(Boolean) : [];
}

export const actions: Actions = {
	deletePost: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM post WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	},
	bulkDelete: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const ids = getIds(data);
		if (ids.length === 0) return fail(400, { error: 'No posts selected' });
		const db = getDatabase();
		const stmt = db.prepare('DELETE FROM post WHERE id = ? AND account_id = ?');
		for (const id of ids) stmt.run(id, accountId);
		return { success: true, bulkDeleted: ids.length };
	},
	bulkUpdateSchedule: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const ids = getIds(data);
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		if (ids.length === 0) return fail(400, { error: 'No posts selected' });
		const db = getDatabase();
		if (scheduleId) {
			const schedule = db.prepare('SELECT id, color FROM schedule WHERE id = ? AND account_id = ?').get(scheduleId, accountId) as { id: string; color: string | null } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule' });
			const scheduleColor = schedule.color ?? null;
			const slotAnchor = new Date();
			slotAnchor.setSeconds(0, 0);
			const updateWithSlot = db.prepare("UPDATE post SET schedule_id = ?, scheduled_at = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const updateNoSlot = db.prepare("UPDATE post SET schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (const id of ids) {
				const slot = getNextFreeSlot(scheduleId, id, accountId, slotAnchor);
				if (slot) {
					updateWithSlot.run(scheduleId, slot, 'scheduled', scheduleColor, id, accountId);
				} else {
					updateNoSlot.run(scheduleId, 'scheduled', scheduleColor, id, accountId);
				}
			}
		} else {
			const stmt = db.prepare("UPDATE post SET schedule_id = NULL, scheduled_at = NULL, status = 'draft', updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (const id of ids) stmt.run(id, accountId);
		}
		return { success: true, bulkUpdated: ids.length };
	},
	bulkUpdateWebhook: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const ids = getIds(data);
		const webhookId = (data.get('webhook_id') as string)?.trim();
		if (ids.length === 0) return fail(400, { error: 'No posts selected' });
		if (!webhookId) return fail(400, { error: 'Webhook required' });
		const db = getDatabase();
		const webhook = db.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?').get(webhookId, accountId) as { id: string } | undefined;
		if (!webhook) return fail(400, { error: 'Invalid webhook' });
		const stmt = db.prepare("UPDATE post SET webhook_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
		for (const id of ids) stmt.run(webhookId, id, accountId);
		return { success: true, bulkUpdated: ids.length };
	},
	deleteAll: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const status = (data.get('status') as string) ?? '';
		const webhookId = (data.get('webhookId') as string) ?? '';
		const scheduled = (data.get('scheduled') as string) ?? '';

		const db = getDatabase();

		// Build WHERE with the same filter logic, but against the post table directly
		let deleteSql = 'DELETE FROM post WHERE account_id = ?';
		const deleteParams: (string | number)[] = [accountId];
		if (status && ['draft', 'scheduled', 'sent', 'failed'].includes(status)) {
			deleteSql += ' AND status = ?';
			deleteParams.push(status);
		}
		if (webhookId) {
			deleteSql += ' AND (webhook_id = ? OR EXISTS (SELECT 1 FROM post_webhook pw WHERE pw.post_id = post.id AND pw.webhook_id = ?))';
			deleteParams.push(webhookId, webhookId);
		}
		if (scheduled === 'yes') {
			deleteSql += ' AND scheduled_at IS NOT NULL';
		} else if (scheduled === 'no') {
			deleteSql += ' AND scheduled_at IS NULL';
		}

		const result = db.prepare(deleteSql).run(...deleteParams);
		return { success: true, deleted: result.changes };
	}
};
