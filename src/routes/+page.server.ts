import { getDatabase } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

function sqliteIso(value: Date): string {
	return value.toISOString().slice(0, 19);
}

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) {
		return {
			stats: null,
			upcomingPosts: [],
			sentThisWeek: 0
		};
	}

	const db = getDatabase();
	const now = sqliteIso(new Date());

	// Post counts by status
	const statusRows = db
		.prepare(
			`SELECT status, COUNT(*) as count FROM post WHERE account_id = ? GROUP BY status`
		)
		.all(accountId) as { status: string; count: number }[];

	const counts = { draft: 0, scheduled: 0, sent: 0, failed: 0 };
	for (const row of statusRows) {
		if (row.status in counts) {
			counts[row.status as keyof typeof counts] = row.count;
		}
	}

	const totalPosts = counts.draft + counts.scheduled + counts.sent + counts.failed;
	const scheduleCount = (db.prepare('SELECT COUNT(*) as c FROM schedule WHERE account_id = ?').get(accountId) as { c: number }).c;
	const webhookCount = (db.prepare('SELECT COUNT(*) as c FROM webhook_config WHERE account_id = ?').get(accountId) as { c: number }).c;

	// Upcoming posts (scheduled in the future, next 14 days)
	const upcomingPosts = db
		.prepare(
			`SELECT p.id, p.title, p.scheduled_at, p.status, w.name as webhook_name
       FROM post p
       JOIN webhook_config w ON p.webhook_id = w.id
       WHERE p.account_id = ? AND p.scheduled_at IS NOT NULL AND p.scheduled_at >= ?
       ORDER BY p.scheduled_at ASC
       LIMIT 10`
		)
		.all(accountId, now) as {
		id: string;
		title: string;
		scheduled_at: string;
		status: string;
		webhook_name: string;
	}[];

	// Sent this week (for "recent activity" feel)
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - weekStart.getDay());
	weekStart.setHours(0, 0, 0, 0);
	const sentThisWeek = (db
		.prepare(
			`SELECT COUNT(*) as c FROM post WHERE account_id = ? AND status = 'sent' AND sent_at >= ?`
		)
		.get(accountId, sqliteIso(weekStart)) as { c: number }).c;

	return {
		stats: {
			totalPosts,
			draft: counts.draft,
			scheduled: counts.scheduled,
			sent: counts.sent,
			failed: counts.failed,
			scheduleCount,
			webhookCount
		},
		upcomingPosts,
		sentThisWeek
	};
};
