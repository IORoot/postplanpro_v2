import { getDatabase } from '$lib/db/index.js';
import cronParser from 'cron-parser';

const MAX_SLOTS_PER_RULE = 500;
const MAX_TOTAL_SLOTS = 2000;

type RuleConfig = {
	expression?: string;
	dayOfWeek?: number;
	dayOfMonth?: number;
	month?: number;
	time?: string;
	amount?: number;
	unit?: 'seconds' | 'minutes' | 'hours' | 'days';
	at?: string;
};

function parseTimeToMinutes(time: string): number {
	// "18:00" or "18:00:00" or "6am" -> minutes since midnight
	const t = time.trim().toLowerCase();
	// HH:MM or HH:MM:SS
	const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
	if (match) {
		const h = parseInt(match[1], 10);
		const m = parseInt(match[2], 10);
		return h * 60 + m;
	}
	// 6am, 6:30am, 6pm
	const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
	if (ampm) {
		let h = parseInt(ampm[1], 10);
		const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
		if (ampm[3] === 'pm' && h < 12) h += 12;
		if (ampm[3] === 'am' && h === 12) h = 0;
		return h * 60 + m;
	}
	return 0;
}

function timeToDate(date: Date, timeStr: string): Date {
	const minutes = parseTimeToMinutes(timeStr);
	const d = new Date(date);
	d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return d;
}

/** Build a date in UTC with the given time (HH:MM). Used for weekly so weekday is consistent. */
function timeToDateUTC(date: Date, timeStr: string): Date {
	const minutes = parseTimeToMinutes(timeStr);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
			h,
			m,
			0,
			0
		)
	);
}

function addInterval(date: Date, amount: number, unit: string): Date {
	const d = new Date(date);
	switch (unit) {
		case 'seconds':
			d.setTime(d.getTime() + amount * 1000);
			break;
		case 'minutes':
			d.setTime(d.getTime() + amount * 60 * 1000);
			break;
		case 'hours':
			d.setTime(d.getTime() + amount * 60 * 60 * 1000);
			break;
		case 'days':
			d.setDate(d.getDate() + amount);
			break;
		default:
			d.setTime(d.getTime() + amount * 60 * 1000);
	}
	return d;
}

function generateFromRule(
	rule: { type: string; config: string; start_at: string | null; end_at: string | null },
	fromDate: Date,
	count: number
): string[] {
	const config = JSON.parse(rule.config || '{}') as RuleConfig;
	const start = rule.start_at ? new Date(rule.start_at) : fromDate;
	const end = rule.end_at ? new Date(rule.end_at) : null;
	const slots: string[] = [];
	const cap = Math.min(count, MAX_SLOTS_PER_RULE);

	switch (rule.type) {
		case 'once': {
			const at = config.at;
			if (!at) break;
			const d = new Date(at);
			if (d >= start && (!end || d <= end)) slots.push(d.toISOString().slice(0, 19));
			break;
		}
		case 'cron': {
			let expr = (config.expression as string)?.trim();
			if (!expr) break;
			// cron-parser expects 6 fields (second minute hour day month dow); allow 5-field Unix and prepend second
			const parts = expr.split(/\s+/);
			if (parts.length === 5) expr = '0 ' + expr;
			try {
				const options: { currentDate?: Date; endDate?: Date } = { currentDate: start };
				if (end) options.endDate = end;
				const interval = cronParser.parseExpression(expr, options);
				for (let i = 0; i < cap; i++) {
					const next = interval.next();
					const d = next.toDate();
					if (end && d > end) break;
					slots.push(d.toISOString().slice(0, 19));
				}
			} catch {
				// invalid cron, skip
			}
			break;
		}
		case 'daily': {
			const time = config.time || '09:00';
			let d = timeToDate(start, time);
			if (d < start) d.setDate(d.getDate() + 1);
			for (let i = 0; i < cap; i++) {
				if (end && d > end) break;
				slots.push(d.toISOString().slice(0, 19));
				d.setDate(d.getDate() + 1);
			}
			break;
		}
		case 'weekly': {
			const dayOfWeek = config.dayOfWeek ?? 0; // 0=Sun, 6=Sat
			const time = config.time || '09:00';
			// Use UTC so weekday and time are consistent regardless of server TZ
			let d = timeToDateUTC(start, time);
			while (d.getUTCDay() !== dayOfWeek || d < start) {
				d.setUTCDate(d.getUTCDate() + 1);
				d = timeToDateUTC(d, time);
			}
			const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
			for (let i = 0; i < cap; i++) {
				if (end && d > end) break;
				slots.push(d.toISOString().slice(0, 19));
				d = new Date(d.getTime() + sevenDaysMs);
			}
			break;
		}
		case 'monthly': {
			const dayNum = Math.min(31, Math.max(1, config.dayOfMonth ?? 1));
			const time = config.time || '09:00';
			let y = start.getFullYear();
			let m = start.getMonth();
			let d = new Date(y, m, Math.min(dayNum, new Date(y, m + 1, 0).getDate()));
			d = timeToDate(d, time);
			if (d < start) {
				m += 1;
				if (m > 11) {
					m = 0;
					y += 1;
				}
				d = timeToDate(new Date(y, m, Math.min(dayNum, new Date(y, m + 1, 0).getDate())), time);
			}
			for (let i = 0; i < cap; i++) {
				if (end && d > end) break;
				slots.push(d.toISOString().slice(0, 19));
				m += 1;
				if (m > 11) {
					m = 0;
					y += 1;
				}
				d = timeToDate(new Date(y, m, Math.min(dayNum, new Date(y, m + 1, 0).getDate())), time);
			}
			break;
		}
		case 'yearly': {
			const month = Math.min(12, Math.max(1, config.month ?? 1)) - 1;
			const dayNum = Math.min(31, Math.max(1, config.dayOfMonth ?? 1));
			const time = config.time || '09:00';
			let y = start.getFullYear();
			let d = new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate()));
			d = timeToDate(d, time);
			if (d < start) {
				y += 1;
				d = timeToDate(new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate())), time);
			}
			for (let i = 0; i < cap; i++) {
				if (end && d > end) break;
				slots.push(d.toISOString().slice(0, 19));
				y += 1;
				d = timeToDate(new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate())), time);
			}
			break;
		}
		case 'interval': {
			const amount = config.amount ?? 1;
			const unit = config.unit ?? 'hours';
			let d = new Date(start);
			for (let i = 0; i < cap; i++) {
				if (end && d > end) break;
				slots.push(d.toISOString().slice(0, 19));
				d = addInterval(d, amount, unit);
			}
			break;
		}
		default:
			break;
	}
	return slots;
}

/**
 * Generate up to `count` slot datetimes for a schedule.
 * Uses schedule_rule first; if no rules, falls back to schedule_slot (fixed slots).
 * Returns ISO-like strings "YYYY-MM-DD HH:MM:SS" for SQLite.
 */
export function generateSlots(scheduleId: string, count: number, fromDate?: Date): string[] {
	const db = getDatabase();
	const from = fromDate ?? new Date();

	const rules = db
		.prepare('SELECT type, config, start_at, end_at, order_index FROM schedule_rule WHERE schedule_id = ? ORDER BY order_index')
		.all(scheduleId) as { type: string; config: string; start_at: string | null; end_at: string | null; order_index: number }[];

	if (rules.length > 0) {
		const allSlots: string[] = [];
		for (const rule of rules) {
			const ruleSlots = generateFromRule(rule, from, count + 100);
			allSlots.push(...ruleSlots);
		}
		allSlots.sort();
		// dedupe and take first N
		const seen = new Set<string>();
		const out: string[] = [];
		for (const s of allSlots) {
			if (seen.has(s)) continue;
			seen.add(s);
			out.push(s);
			if (out.length >= count) break;
		}
		return out.slice(0, Math.min(count, MAX_TOTAL_SLOTS));
	}

	// Fallback: fixed schedule_slot (legacy)
	const slots = db
		.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
		.all(scheduleId) as { scheduled_at: string }[];
	return slots.slice(0, count).map((r) => r.scheduled_at);
}

/** Normalize datetime string to ISO slice (YYYY-MM-DDTHH:MM:SS) for comparison. */
function normalizeSlot(s: string): string {
	const trimmed = (s || '').trim().replace(' ', 'T');
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
		const d = new Date(trimmed);
		if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 19);
	}
	return trimmed.slice(0, 19);
}

/**
 * Return the next available slot for a schedule that is not already used by another post with this schedule.
 * When editing, pass excludePostId so the current post's slot is not considered "taken".
 */
export function getNextFreeSlot(scheduleId: string, excludePostId?: string | null): string | null {
	const db = getDatabase();
	const taken = db
		.prepare(
			'SELECT scheduled_at FROM post WHERE schedule_id = ? AND scheduled_at IS NOT NULL' +
				(excludePostId ? ' AND id != ?' : '')
		)
		.all(excludePostId ? [scheduleId, excludePostId] : [scheduleId]) as { scheduled_at: string }[];
	const takenSet = new Set(taken.map((r) => normalizeSlot(r.scheduled_at)));
	const from = new Date();
	const slots = generateSlots(scheduleId, 500, from);
	for (const slot of slots) {
		const norm = normalizeSlot(slot);
		if (!takenSet.has(norm)) {
			const d = new Date(norm);
			if (d >= from) return norm;
		}
	}
	return null;
}
