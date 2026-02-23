import { getDatabase } from '$lib/db/index.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { posts: [], webhooks: [], schedules: [], filters: { status: '', webhookId: '', scheduled: '' } };
	const db = getDatabase();
	const status = url.searchParams.get('status') ?? '';
	const webhookId = url.searchParams.get('webhook') ?? '';
	const scheduled = url.searchParams.get('scheduled') ?? ''; // 'yes' | 'no' | ''

	let sql = `
		SELECT p.id, p.webhook_id, p.schedule_id, p.title, p.content, p.image_url, p.color, p.scheduled_at, p.status, p.sent_at, p.created_at, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.account_id = ?
	`;
	const params: (string | number)[] = [accountId];
	if (status && ['draft', 'scheduled', 'sent', 'failed'].includes(status)) {
		sql += ' AND p.status = ?';
		params.push(status);
	}
	if (webhookId) {
		sql += ' AND p.webhook_id = ?';
		params.push(webhookId);
	}
	if (scheduled === 'yes') {
		sql += ' AND p.scheduled_at IS NOT NULL';
	} else if (scheduled === 'no') {
		sql += ' AND p.scheduled_at IS NULL';
	}
	sql += ' ORDER BY p.created_at DESC';

	const posts = db.prepare(sql).all(...params) as {
		id: string;
		webhook_id: string;
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
	}[];

	const webhooks = db.prepare('SELECT id, name FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];

	return { posts, webhooks, schedules, filters: { status, webhookId, scheduled } };
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
			const updateWithSlot = db.prepare("UPDATE post SET schedule_id = ?, scheduled_at = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const updateNoSlot = db.prepare("UPDATE post SET schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (const id of ids) {
				const slot = getNextFreeSlot(scheduleId, id, accountId);
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
	}
};
