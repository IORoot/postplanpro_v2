import { getDatabase } from '$lib/db/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function sqliteIso(value: Date): string {
	return value.toISOString().slice(0, 19);
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const accountId = locals.userId;
	if (!accountId) return json({ error: 'Unauthorized' }, { status: 401 });

	const now = new Date();
	const rawYear = Number(url.searchParams.get('year'));
	const rawMonth = Number(url.searchParams.get('month'));
	const year = Number.isInteger(rawYear) && rawYear >= 1970 && rawYear <= 2100 ? rawYear : now.getFullYear();
	const month = Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11 ? rawMonth : now.getMonth();

	const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
	const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

	const db = getDatabase();
	const rows = db
		.prepare(
			`SELECT substr(scheduled_at, 1, 10) as day, COUNT(*) as count
       FROM post
       WHERE account_id = ? AND scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ?
       GROUP BY substr(scheduled_at, 1, 10)`
		)
		.all(accountId, sqliteIso(monthStart), sqliteIso(monthEnd)) as {
		day: string;
		count: number;
	}[];

	const markers: Record<string, number> = {};
	for (const row of rows) {
		markers[row.day] = row.count;
	}

	return json({ year, month, markers });
};
