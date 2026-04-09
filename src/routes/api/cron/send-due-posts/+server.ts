import { env } from '$env/dynamic/private';
import { sendDuePosts } from '$lib/scheduler/sendDuePosts.js';
import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';

function secretsMatch(a: string, b: string): boolean {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}

export const GET: RequestHandler = async ({ request }) => {
	const CRON_SECRET = env.CRON_SECRET ?? '';
	const headerSecret = request.headers.get('x-cron-secret') ?? '';
	if (!CRON_SECRET || !headerSecret || !secretsMatch(headerSecret, CRON_SECRET)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const result = await sendDuePosts();
	return json(result);
};
