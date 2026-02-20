import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const db = getDatabase();
	const status = url.searchParams.get('status') ?? '';
	const webhookId = url.searchParams.get('webhook') ?? '';
	const scheduled = url.searchParams.get('scheduled') ?? ''; // 'yes' | 'no' | ''

	let sql = `
		SELECT p.id, p.webhook_id, p.schedule_id, p.title, p.content, p.scheduled_at, p.status, p.sent_at, p.created_at, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE 1=1
	`;
	const params: (string | number)[] = [];
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
		scheduled_at: string | null;
		status: string;
		sent_at: string | null;
		created_at: string;
		webhook_name: string;
	}[];

	const webhooks = db.prepare('SELECT id, name FROM webhook_config ORDER BY name').all() as { id: string; name: string }[];

	return { posts, webhooks, filters: { status, webhookId, scheduled } };
};

export const actions: Actions = {
	deletePost: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM post WHERE id = ?').run(id);
		return { success: true };
	}
};
