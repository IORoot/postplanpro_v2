import type { Session } from '@auth/sveltekit';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '$lib/db/index.js';
import type { LayoutServerLoad } from './$types';

const appVersion = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
).version as string;

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
	let userTier: string | null = null;
	if (accountId) {
		const db = getDatabase();
		const tierRow = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string } | undefined;
		userTier = tierRow?.tier ?? null;
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
		userTier,
		appVersion
	};
};
