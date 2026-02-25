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
			sentThisWeek: 0,
			stagePasses: 0,
			stageFails: 0,
			lastPublishedPosts: [],
			failedPosts: [],
			postsWithFailedStages: []
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

	// Make.com stage pass/fail counts
	const stageCountRows = db
		.prepare(
			`SELECT s.status, COUNT(*) as count FROM post_stage s JOIN post p ON p.id = s.post_id WHERE p.account_id = ? GROUP BY s.status`
		)
		.all(accountId) as { status: string; count: number }[];
	let stagePasses = 0;
	let stageFails = 0;
	for (const row of stageCountRows) {
		if (row.status === 'pass') stagePasses = row.count;
		else if (row.status === 'fail') stageFails = row.count;
	}

	// Last 10 published (sent) posts
	const lastPublishedPosts = db
		.prepare(
			`SELECT p.id, p.title, p.sent_at, w.name as webhook_name
       FROM post p
       JOIN webhook_config w ON p.webhook_id = w.id
       WHERE p.account_id = ? AND p.status = 'sent'
       ORDER BY p.sent_at DESC
       LIMIT 10`
		)
		.all(accountId) as { id: string; title: string; sent_at: string | null; webhook_name: string }[];

	// Failed posts (send failed)
	const failedPosts = db
		.prepare(
			`SELECT id, title, error_message, updated_at FROM post
       WHERE account_id = ? AND status = 'failed'
       ORDER BY updated_at DESC`
		)
		.all(accountId) as { id: string; title: string; error_message: string | null; updated_at: string }[];

	// Posts that have at least one failed Make.com stage
	const postsWithFailedStages = db
		.prepare(
			`SELECT DISTINCT p.id, p.title, p.sent_at
       FROM post p
       JOIN post_stage s ON s.post_id = p.id
       WHERE p.account_id = ? AND s.status = 'fail'
       ORDER BY p.sent_at DESC, p.updated_at DESC`
		)
		.all(accountId) as { id: string; title: string; sent_at: string | null }[];

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
		sentThisWeek,
		stagePasses,
		stageFails,
		lastPublishedPosts,
		failedPosts,
		postsWithFailedStages
	};
};
