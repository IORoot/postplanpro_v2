import { sendPost } from '$lib/scheduler/sendDuePosts.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const result = await sendPost(params.id);
	if (result.success) return json(result);
	return json(result, { status: 400 });
};
