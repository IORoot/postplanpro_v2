import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { schedules: [] };
	const db = getDatabase();
	const schedules = db
		.prepare(
			`
		SELECT s.id, s.name, s.description, s.created_at,
			(SELECT COUNT(*) FROM schedule_slot WHERE schedule_id = s.id) as slot_count,
			(SELECT COUNT(*) FROM schedule_rule WHERE schedule_id = s.id) as rule_count
		FROM schedule s
		WHERE s.account_id = ?
		ORDER BY s.name
	`
		)
		.all(accountId) as {
		id: string;
		name: string;
		description: string | null;
		created_at: string;
		slot_count: number;
		rule_count: number;
	}[];
	return { schedules };
};

export const actions: Actions = {
	deleteSchedule: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM schedule WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	}
};
