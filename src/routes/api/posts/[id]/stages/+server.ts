import { getDatabase } from '$lib/db/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const accountId = locals.userId;
	if (!accountId) return json({ error: 'Unauthorized' }, { status: 401 });

	const db = getDatabase();
	const post = db
		.prepare('SELECT id FROM post WHERE id = ? AND account_id = ?')
		.get(params.id, accountId) as { id: string } | undefined;
	if (!post) return json({ error: 'Post not found' }, { status: 404 });

	const stages = db
		.prepare('SELECT stage, status, completed_at FROM post_stage WHERE post_id = ? ORDER BY completed_at')
		.all(params.id) as { stage: string; status: string; completed_at: string }[];

	return json({ stages });
};
