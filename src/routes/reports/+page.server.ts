import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDatabase();
	const rows = db
		.prepare(
			`SELECT l.id, l.post_id, l.sent_at, l.request_json, l.response_status, l.response_body, l.success,
        p.title as post_title,
        w.name as webhook_name
     FROM send_log l
     JOIN post p ON p.id = l.post_id
     JOIN webhook_config w ON w.id = p.webhook_id
     ORDER BY l.sent_at DESC`
		)
		.all() as {
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
	clearLogs: async () => {
		getDatabase().prepare('DELETE FROM send_log').run();
		return { success: true };
	},
	deleteReport: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM send_log WHERE id = ?').run(id);
		return { success: true };
	}
};
