import { getDatabase } from '$lib/db/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type StatusRequest = {
	ids?: unknown;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const accountId = locals.userId;
	if (!accountId) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: StatusRequest;
	try {
		payload = (await request.json()) as StatusRequest;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const ids = Array.isArray(payload.ids)
		? payload.ids.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
		: [];
	if (ids.length === 0) return json({ statuses: [] });

	// Guard against abuse and SQL limits.
	const limitedIds = Array.from(new Set(ids)).slice(0, 500);
	const placeholders = limitedIds.map(() => '?').join(', ');
	const db = getDatabase();
	const rows = db
		.prepare(
			`SELECT id, status, scheduled_at
       FROM post
       WHERE account_id = ? AND id IN (${placeholders})`
		)
		.all(accountId, ...limitedIds) as {
		id: string;
		status: string;
		scheduled_at: string | null;
	}[];

	return json({ statuses: rows });
};

