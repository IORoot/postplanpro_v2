import { getDatabase } from '$lib/db/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('Authorization');
	const apiKeyToken = request.headers.get('X-API-KEY') ?? request.headers.get('x-api-key');
	const callbackHeaderToken =
		request.headers.get('X-Callback-Token') ?? request.headers.get('x-callback-token');
	const token =
		apiKeyToken?.trim() ||
		callbackHeaderToken?.trim() ||
		(authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);
	if (!token) {
		return json({ error: 'Missing API key. Use X-API-KEY: <token>.' }, { status: 401 });
	}

	const db = getDatabase();
	const user = db.prepare('SELECT id FROM user WHERE callback_token = ?').get(token) as { id: string } | undefined;
	if (!user) {
		return json({ error: 'Invalid callback token.' }, { status: 401 });
	}
	const accountId = user.id;

	let body: { post_id?: string; stage?: string; stage_passed?: string; stage_failed?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}
	const postId = typeof body.post_id === 'string' ? body.post_id.trim() : '';
	const stageFromPass = typeof body.stage_passed === 'string' ? body.stage_passed.trim() : '';
	const stageFromFail = typeof body.stage_failed === 'string' ? body.stage_failed.trim() : '';
	const stageLegacy = typeof body.stage === 'string' ? body.stage.trim() : '';

	let stage: string;
	let status: 'pass' | 'fail';
	if (stageFromFail) {
		stage = stageFromFail;
		status = 'fail';
	} else if (stageFromPass) {
		stage = stageFromPass;
		status = 'pass';
	} else if (stageLegacy) {
		stage = stageLegacy;
		status = 'pass';
	} else {
		return json(
			{ error: 'Body must include post_id and one of: stage, stage_passed, or stage_failed (non-empty strings).' },
			{ status: 400 }
		);
	}
	if (!postId || !stage) {
		return json(
			{ error: 'Body must include post_id and one of: stage, stage_passed, or stage_failed (non-empty strings).' },
			{ status: 400 }
		);
	}

	const post = db.prepare('SELECT id, account_id FROM post WHERE id = ? AND account_id = ?').get(postId, accountId) as
		| { id: string; account_id: string }
		| undefined;
	if (!post) {
		return json({ error: 'Post not found or access denied.' }, { status: 404 });
	}

	const id = crypto.randomUUID();
	db.prepare(
		"INSERT OR REPLACE INTO post_stage (id, post_id, stage, status, completed_at) VALUES (?, ?, ?, ?, datetime('now'))"
	).run(id, postId, stage, status);

	return json({ ok: true });
};
