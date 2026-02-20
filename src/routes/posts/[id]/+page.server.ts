import { getDatabase } from '$lib/db/index.js';
import { normalizePostColor } from '$lib/postColors.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const accountId = locals.userId;
	if (!accountId) throw redirect(303, '/auth/login');
	const db = getDatabase();
	const post = db.prepare('SELECT * FROM post WHERE id = ? AND account_id = ?').get(params.id, accountId) as {
		id: string;
		webhook_id: string;
		schedule_id: string | null;
		title: string;
		content: string | null;
		image_url: string | null;
		color: string | null;
		payload_override: string | null;
		scheduled_at: string | null;
		status: string;
		sent_at: string | null;
		error_message: string | null;
		created_at: string;
		updated_at: string;
	} | undefined;
	if (!post) throw redirect(303, '/posts');

	const fields = db.prepare('SELECT id, key, type, value FROM post_field WHERE post_id = ? ORDER BY key').all(params.id) as {
		id: string;
		key: string;
		type: string;
		value: string | null;
	}[];
	const globals = db.prepare('SELECT key, type, value FROM global_variable WHERE account_id = ? ORDER BY key').all(accountId) as {
		key: string;
		type: string;
		value: string | null;
	}[];

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

	return { post, fields, globals, webhooks, schedules, templates: [...byTemplate.values()] };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const content = (data.get('content') as string)?.trim() ?? '';
		const image_url = (data.get('image_url') as string)?.trim() || null;
		const color = normalizePostColor(data.get('color') as string);
		const overrideEnabled = data.get('payload_override_enabled') === '1';
		const overrideInput = ((data.get('payload_override') as string) ?? '').trim();
		let payloadOverride: string | null = null;
		if (overrideEnabled) {
			if (!overrideInput) return fail(400, { error: 'Override JSON is enabled but empty' });
			try {
				payloadOverride = JSON.stringify(JSON.parse(overrideInput));
			} catch {
				return fail(400, { error: 'Override JSON is invalid' });
			}
		}
		const webhook_id = data.get('webhook_id') as string;
		const scheduleBy = (data.get('schedule_by') as string) || 'none';
		const schedule_id = (data.get('schedule_id') as string)?.trim() || null;
		let scheduled_at: string | null;
		let resolvedScheduleId: string | null = null;
		if (scheduleBy === 'schedule' && schedule_id) {
			const slot = getNextFreeSlot(schedule_id, params.id, accountId);
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
		const existing = db
			.prepare('SELECT id FROM post WHERE id = ? AND account_id = ?')
			.get(params.id, accountId) as { id: string } | undefined;
		if (!existing) return fail(404, { error: 'Post not found' });
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
		db.prepare(
			"UPDATE post SET webhook_id = ?, schedule_id = ?, title = ?, content = ?, image_url = ?, color = ?, payload_override = ?, scheduled_at = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
		).run(
			webhook_id,
			resolvedScheduleId,
			title,
			content,
			image_url,
			color,
			payloadOverride,
			scheduled_at,
			status,
			params.id,
			accountId
		);

		// Replace custom fields: delete existing, insert from form
		db.prepare('DELETE FROM post_field WHERE post_id = ?').run(params.id);
		const fieldKeys = [...data.entries()].filter(([k]) => k.startsWith('field_key_')).map(([k]) => k.replace('field_key_', ''));
		for (const idx of fieldKeys) {
			const key = (data.get(`field_key_${idx}`) as string)?.trim();
			if (!key) continue;
			const type = (data.get(`field_type_${idx}`) as string) || 'string';
			const value = (data.get(`field_value_${idx}`) as string) ?? '';
			const fieldId = crypto.randomUUID();
			db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, params.id, key, type, value);
		}

		throw redirect(303, '/posts');
	}
};
