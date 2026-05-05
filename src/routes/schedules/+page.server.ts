import { getDatabase } from '$lib/db/index.js';
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const accountId = locals.userId;
	if (!accountId) return { schedules: [], page: 1, pageSize: 50 as PageSize, total: 0 };
	const page = parsePage(url.searchParams.get('page'));
	const pageSize = parsePageSize(url.searchParams.get('pageSize'));
	const db = getDatabase();
	const total =
		(db.prepare('SELECT COUNT(*) as count FROM schedule WHERE account_id = ?').get(accountId) as
			| { count: number }
			| undefined)?.count ?? 0;
	const offset = (page - 1) * pageSize;
	const schedules = db
		.prepare(
			`
		SELECT s.id, s.name, s.description, s.color, s.created_at,
			(SELECT COUNT(*) FROM schedule_slot WHERE schedule_id = s.id) as slot_count,
			(SELECT COUNT(*) FROM schedule_rule WHERE schedule_id = s.id) as rule_count
		FROM schedule s
		WHERE s.account_id = ?
		ORDER BY s.name
		LIMIT ? OFFSET ?
	`
		)
		.all(accountId, pageSize, offset) as {
		id: string;
		name: string;
		description: string | null;
		color: string | null;
		created_at: string;
		slot_count: number;
		rule_count: number;
	}[];
	return { schedules, page, pageSize, total };
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
