import { getDatabase } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const year = parseInt(url.searchParams.get('year') ?? new Date().getFullYear().toString(), 10);
	const month = parseInt(url.searchParams.get('month') ?? (new Date().getMonth() + 1).toString(), 10);
	const lastDay = new Date(year, month, 0).getDate();
	const startStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
	const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

	const db = getDatabase();
	const posts = db
		.prepare(
			`
		SELECT p.id, p.title, p.scheduled_at, p.status, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.scheduled_at IS NOT NULL AND p.scheduled_at >= ? AND p.scheduled_at <= ?
		ORDER BY p.scheduled_at
	`
		)
		.all(startStr, endStr) as {
		id: string;
		title: string;
		scheduled_at: string;
		status: string;
		webhook_name: string;
	}[];

	return { posts, year, month };
};
