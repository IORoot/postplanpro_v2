import { getDatabase } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

type CalendarView = 'day' | 'week' | 'month' | 'year' | 'agenda' | 'schedule';
type CalendarPostRow = {
	id: string;
	title: string;
	image_url: string | null;
	color: string | null;
	scheduled_at: string;
	status: string;
	webhook_name: string;
};

const ALLOWED_VIEWS = new Set<CalendarView>([
	'day',
	'week',
	'month',
	'year',
	'agenda',
	'schedule'
]);

function parseDate(value: string | null): Date {
	if (!value) return new Date();
	const candidate = new Date(value);
	return Number.isNaN(candidate.getTime()) ? new Date() : candidate;
}

function rangeFor(view: CalendarView, anchor: Date): { start: Date; end: Date } {
	const start = new Date(anchor);
	const end = new Date(anchor);
	start.setHours(0, 0, 0, 0);
	end.setHours(23, 59, 59, 999);

	if (view === 'day') {
		// Day view still renders one day of posts, but the quick week strip needs
		// markers for every day in the current week.
		const offsetToMonday = (start.getDay() + 6) % 7;
		start.setDate(start.getDate() - offsetToMonday);
		end.setTime(start.getTime());
		end.setDate(start.getDate() + 6);
		end.setHours(23, 59, 59, 999);
		return { start, end };
	}
	if (view === 'week') {
		// Week view UI shows all weeks for the current month in the week strip.
		// Load the whole month span expanded to Monday..Sunday boundaries so
		// markers are visible for every week chip, not only the active week.
		start.setDate(1);
		const offsetToMonday = (start.getDay() + 6) % 7;
		start.setDate(start.getDate() - offsetToMonday);
		end.setFullYear(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		const offsetToSunday = (7 - end.getDay()) % 7;
		end.setDate(end.getDate() + offsetToSunday);
		end.setHours(23, 59, 59, 999);
		return { start, end };
	}
	if (view === 'month') {
		start.setDate(1);
		end.setMonth(start.getMonth() + 1, 0);
		return { start, end };
	}
	if (view === 'year') {
		start.setMonth(0, 1);
		end.setMonth(11, 31);
		return { start, end };
	}
	if (view === 'schedule') {
		start.setMonth(0, 1);
		end.setMonth(11, 31);
		return { start, end };
	}
	// agenda fallback range (not used in query; kept for labels)
	end.setDate(start.getDate() + 59);
	return { start, end };
}

function sqliteIso(value: Date): string {
	return value.toISOString().slice(0, 19);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const accountId = locals.userId;
	const rawView = (url.searchParams.get('view') ?? 'month') as CalendarView;
	const view: CalendarView = ALLOWED_VIEWS.has(rawView) ? rawView : 'month';
	const anchor = parseDate(url.searchParams.get('date'));
	const { start, end } = rangeFor(view, anchor);
	const startStr = sqliteIso(start);
	const endStr = sqliteIso(end);

	const db = getDatabase();
	const posts: CalendarPostRow[] = accountId
		? ((view === 'agenda'
				? db.prepare(
					`
		SELECT p.id, p.title, p.image_url, p.color, p.scheduled_at, p.status, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.account_id = ? AND p.scheduled_at IS NOT NULL
		ORDER BY p.scheduled_at
	`
				  ).all(accountId)
				: db.prepare(
					`
		SELECT p.id, p.title, p.image_url, p.color, p.scheduled_at, p.status, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.account_id = ? AND p.scheduled_at IS NOT NULL AND p.scheduled_at >= ? AND p.scheduled_at <= ?
		ORDER BY p.scheduled_at
	`
				  ).all(accountId, startStr, endStr)) as CalendarPostRow[])
		: [];

	return {
		posts,
		view,
		anchorDate: anchor.toISOString().slice(0, 10),
		rangeStart: start.toISOString().slice(0, 10),
		rangeEnd: end.toISOString().slice(0, 10)
	};
};
