import type { Session } from '@auth/sveltekit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '$lib/db/index.js';
import { ensureValidTimeZone } from '$lib/server/timezone.js';
import { currentMonthKey, getUsageForMonth } from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
import type { LayoutServerLoad } from './$types';

// Must not use import.meta.url + relative path: SSR bundle lives under
// .svelte-kit/output/server/entries/... so ../../package.json points at the wrong place and breaks vite build.
const appVersion = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version as string;

function sqliteIso(value: Date): string {
	return value.toISOString().slice(0, 19);
}

export const load: LayoutServerLoad = async ({ locals }) => {
	let session: Session | null = null;
	try {
		session = await locals.auth();
	} catch (e) {
		console.error('[layout] locals.auth() failed:', e instanceof Error ? e.message : e);
		session = null;
	}

	const accountId = locals.userId;
	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

	let sidebarCalendar: { year: number; month: number; markers: Record<string, number> } | null = null;
	let sidebarPlanUsage: {
		posts: { used: number; limit: number | null };
		imports: { used: number; limit: number | null };
		callbacks: { used: number; limit: number | null };
	} | null = null;
	let userTier: string | null = null;
	let userTimezone = 'Europe/London';
	if (accountId) {
		const db = getDatabase();
		const tierRow = db.prepare('SELECT tier, timezone FROM user WHERE id = ?').get(accountId) as
			| { tier: string; timezone: string | null }
			| undefined;
		userTier = tierRow?.tier ?? null;
		userTimezone = ensureValidTimeZone(tierRow?.timezone);
		const monthKey = currentMonthKey();
		const usage = getUsageForMonth(db, accountId, monthKey);
		const limits = getTierLimits(userTier ?? 'free');
		sidebarPlanUsage = {
			/* Same as account billing `postsTotal`: sent + scheduled in month (quota usage). */
			posts: { used: usage.postsSent + usage.postsScheduled, limit: limits.postsSentPerMonth },
			imports: { used: usage.importOperations, limit: limits.importOperationsPerMonth },
			callbacks: { used: usage.callbackInputs, limit: limits.callbackInputsPerMonth }
		};
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
		sidebarCalendar = {
			year: now.getFullYear(),
			month: now.getMonth(),
			markers
		};
	}

	return {
		session,
		sidebarCalendar,
		sidebarPlanUsage,
		userTier,
		userTimezone,
		appVersion
	};
};
