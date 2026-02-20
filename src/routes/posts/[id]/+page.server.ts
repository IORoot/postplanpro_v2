import { getDatabase } from '$lib/db/index.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const db = getDatabase();
	const post = db.prepare('SELECT * FROM post WHERE id = ?').get(params.id) as {
		id: string;
		webhook_id: string;
		schedule_id: string | null;
		title: string;
		content: string | null;
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

	const webhooks = db.prepare('SELECT id, name FROM webhook_config ORDER BY name').all() as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule ORDER BY name').all() as { id: string; name: string }[];

	return { post, fields, webhooks, schedules };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const content = (data.get('content') as string)?.trim() ?? '';
		const webhook_id = data.get('webhook_id') as string;
		const scheduleBy = (data.get('schedule_by') as string) || 'none';
		const schedule_id = (data.get('schedule_id') as string)?.trim() || null;
		let scheduled_at: string | null;
		let resolvedScheduleId: string | null = null;
		if (scheduleBy === 'schedule' && schedule_id) {
			const slot = getNextFreeSlot(schedule_id, params.id);
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
		db.prepare(
			'UPDATE post SET webhook_id = ?, schedule_id = ?, title = ?, content = ?, scheduled_at = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
		).run(webhook_id, resolvedScheduleId, title, content, scheduled_at, status, params.id);

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
