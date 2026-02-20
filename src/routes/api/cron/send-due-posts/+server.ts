import { sendDuePosts } from '$lib/scheduler/sendDuePosts.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CRON_SECRET = process.env.CRON_SECRET || '';

export const GET: RequestHandler = async ({ request, url }) => {
	const secret = request.headers.get('x-cron-secret') || url.searchParams.get('secret') || '';
	if (!CRON_SECRET || secret !== CRON_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const result = await sendDuePosts();
	return json(result);
};
