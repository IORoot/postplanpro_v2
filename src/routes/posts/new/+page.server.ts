import { getDatabase } from '$lib/db/index.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name FROM webhook_config ORDER BY name').all() as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule ORDER BY name').all() as { id: string; name: string }[];
	return { webhooks, schedules };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const content = (data.get('content') as string)?.trim() ?? '';
		const webhook_id = data.get('webhook_id') as string;
		const scheduleBy = (data.get('schedule_by') as string) || 'none';
		const schedule_id = (data.get('schedule_id') as string)?.trim() || null;
		let scheduled_at: string | null;
		let resolvedScheduleId: string | null = null;
		if (scheduleBy === 'schedule' && schedule_id) {
			const slot = getNextFreeSlot(schedule_id);
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
		const id = crypto.randomUUID();
		db.prepare(
			'INSERT INTO post (id, webhook_id, schedule_id, title, content, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
		).run(id, webhook_id, resolvedScheduleId, title, content, scheduled_at, status);

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
