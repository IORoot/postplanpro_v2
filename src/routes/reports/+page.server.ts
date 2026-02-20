import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { reports: [] };
	const db = getDatabase();
	const rows = db
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
	}[];

	return { reports: rows };
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
