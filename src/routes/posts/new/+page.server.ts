import { getDatabase } from '$lib/db/index.js';
import { normalizePostColor, randomTailwindPostColor } from '$lib/postColors.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { webhooks: [], schedules: [], templates: [] };
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const templates = db
		.prepare(
			`SELECT t.id, t.name, t.is_default, f.key, f.type, f.value, f.order_index
       FROM field_template t
       LEFT JOIN field_template_field f ON f.template_id = t.id
       WHERE t.account_id = ? OR t.account_id IS NULL
       ORDER BY t.is_default DESC, t.name, f.order_index`
		)
		.all(accountId) as {
		id: string;
		name: string;
		is_default: number;
		key: string | null;
		type: string | null;
		value: string | null;
		order_index: number | null;
	}[];
	const byTemplate = new Map<string, { id: string; name: string; is_default: boolean; fields: { key: string; type: string; value: string }[] }>();
	for (const row of templates) {
		let t = byTemplate.get(row.id);
		if (!t) {
			t = { id: row.id, name: row.name, is_default: row.is_default === 1, fields: [] };
			byTemplate.set(row.id, t);
		}
		if (row.key) {
			t.fields.push({
				key: row.key,
				type: row.type ?? 'string',
				value: row.value ?? ''
			});
		}
	}
	return { webhooks, schedules, templates: [...byTemplate.values()], defaultColor: randomTailwindPostColor() };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const content = (data.get('content') as string)?.trim() ?? '';
		const image_url = (data.get('image_url') as string)?.trim() || null;
		const color = normalizePostColor(data.get('color') as string) ?? randomTailwindPostColor();
		const webhook_id = data.get('webhook_id') as string;
		const scheduleBy = (data.get('schedule_by') as string) || 'none';
		const schedule_id = (data.get('schedule_id') as string)?.trim() || null;
		let scheduled_at: string | null;
		let resolvedScheduleId: string | null = null;
		if (scheduleBy === 'schedule' && schedule_id) {
			const slot = getNextFreeSlot(schedule_id, undefined, accountId);
			if (!slot) return fail(400, { error: 'That schedule has no available slots. Add more rules or slots to the schedule.' });
			scheduled_at = slot;
			resolvedScheduleId = schedule_id;
		} else if (scheduleBy === 'datetime') {
			scheduled_at = (data.get('scheduled_at') as string)?.trim() || null;
		} else {
			scheduled_at = null;
		}
		const status = (scheduled_at ? 'scheduled' : 'draft') as 'draft' | 'scheduled';
		if (!title || !webhook_id) return fail(400, { error: 'Title and webhook are required' });

		const db = getDatabase();
		const webhookExists = db
			.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
			.get(webhook_id, accountId) as { id: string } | undefined;
		if (!webhookExists) return fail(400, { error: 'Invalid webhook' });
		if (schedule_id) {
			const scheduleExists = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(schedule_id, accountId) as { id: string } | undefined;
			if (!scheduleExists) return fail(400, { error: 'Invalid schedule' });
		}
		const id = crypto.randomUUID();
		db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, image_url, color, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		).run(id, accountId, webhook_id, resolvedScheduleId, title, content, image_url, color, scheduled_at, status);

		// Custom fields: field_key_0, field_type_0, field_value_0, ...
		const fieldKeys = [...data.entries()].filter(([k]) => k.startsWith('field_key_')).map(([k]) => k.replace('field_key_', ''));
		for (const idx of fieldKeys) {
			const key = (data.get(`field_key_${idx}`) as string)?.trim();
			if (!key) continue;
			const type = (data.get(`field_type_${idx}`) as string) || 'string';
			const value = (data.get(`field_value_${idx}`) as string) ?? '';
			const fieldId = crypto.randomUUID();
			db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, id, key, type, value);
		}

		throw redirect(303, '/posts');
	}
};
