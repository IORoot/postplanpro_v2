import { sendPost } from '$lib/scheduler/sendDuePosts.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const accountId = locals.userId;
	if (!accountId) return json({ success: false, error: "Unauthorized" }, { status: 401 });
	const result = await sendPost(params.id, accountId);
	if (result.success) return json(result);
	return json(result, { status: 400 });
};
