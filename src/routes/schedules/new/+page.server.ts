import { getDatabase } from '$lib/db/index.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const description = (data.get('description') as string)?.trim() || null;
		if (!name) return fail(400, { error: 'Name is required' });

		const db = getDatabase();
		const id = crypto.randomUUID();
		db.prepare('INSERT INTO schedule (id, name, description) VALUES (?, ?, ?)').run(id, name, description);

		// Rules (recurring) or legacy slots
		const rulesJson = (data.get('rules_json') as string)?.trim();
		if (rulesJson && rulesJson !== '[]') {
			try {
				const rules = JSON.parse(rulesJson) as { type: string; config: Record<string, unknown>; start_at?: string | null; end_at?: string | null }[];
				rules.forEach((r, i) => {
					if (!r.type || !r.config) return;
					const ruleId = crypto.randomUUID();
					db.prepare('INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
						ruleId,
						id,
						r.type,
						JSON.stringify(r.config),
						r.start_at || null,
						r.end_at || null,
						i
					);
				});
			} catch {
				// invalid JSON
			}
		} else {
			const slotKeys = [...data.entries()].filter(([k]) => k.startsWith('slot_')).map(([k]) => k.replace('slot_', ''));
			const sortedIndices = [...new Set(slotKeys)].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
			for (let i = 0; i < sortedIndices.length; i++) {
				const idx = sortedIndices[i];
				const val = (data.get(`slot_${idx}`) as string)?.trim();
				if (!val) continue;
				const slotId = crypto.randomUUID();
				db.prepare('INSERT INTO schedule_slot (id, schedule_id, scheduled_at, order_index) VALUES (?, ?, ?, ?)').run(slotId, id, val, i);
			}
		}

		// Schedule fields: field_key_0, field_type_0, field_value_0
		const fieldKeys = [...data.entries()].filter(([k]) => k.startsWith('field_key_')).map(([k]) => k.replace('field_key_', ''));
		for (const idx of fieldKeys) {
			const key = (data.get(`field_key_${idx}`) as string)?.trim();
			if (!key) continue;
			const type = (data.get(`field_type_${idx}`) as string) || 'string';
			const value = (data.get(`field_value_${idx}`) as string) ?? '';
			const fieldId = crypto.randomUUID();
			db.prepare('INSERT INTO schedule_field (id, schedule_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, id, key, type, value);
		}

		throw redirect(303, '/schedules');
	}
};
