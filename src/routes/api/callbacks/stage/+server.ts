import { getDatabase } from '$lib/db/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('Authorization');
	const token =
		authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : request.headers.get('X-Callback-Token')?.trim();
	if (!token) {
		return json({ error: 'Missing callback token. Use Authorization: Bearer <token> or X-Callback-Token.' }, { status: 401 });
	}

	const db = getDatabase();
	const user = db.prepare('SELECT id FROM user WHERE callback_token = ?').get(token) as { id: string } | undefined;
	if (!user) {
		return json({ error: 'Invalid callback token.' }, { status: 401 });
	}
	const accountId = user.id;

	let body: { post_id?: string; stage?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}
	const postId = typeof body.post_id === 'string' ? body.post_id.trim() : '';
	const stage = typeof body.stage === 'string' ? body.stage.trim() : '';
	if (!postId || !stage) {
		return json({ error: 'Body must include post_id and stage (non-empty strings).' }, { status: 400 });
	}

	const post = db.prepare('SELECT id, account_id FROM post WHERE id = ? AND account_id = ?').get(postId, accountId) as
		| { id: string; account_id: string }
		| undefined;
	if (!post) {
		return json({ error: 'Post not found or access denied.' }, { status: 404 });
	}

	const id = crypto.randomUUID();
	db.prepare(
		"INSERT OR IGNORE INTO post_stage (id, post_id, stage, completed_at) VALUES (?, ?, ?, datetime('now'))"
	).run(id, postId, stage);

	return json({ ok: true });
};
