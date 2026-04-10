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

/** Strip BOM/CRLF and surrounding whitespace from .env / curl (avoids 401 when host and container differ by a \\r). */
function normalizeCronSecret(s: string): string {
	return s.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
}

export const GET: RequestHandler = async ({ request }) => {
	const CRON_SECRET = normalizeCronSecret(env.CRON_SECRET ?? '');
	const headerSecret = normalizeCronSecret(request.headers.get('x-cron-secret') ?? '');
	if (!CRON_SECRET || !headerSecret || !secretsMatch(headerSecret, CRON_SECRET)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const result = await sendDuePosts();
	return json(result);
};
