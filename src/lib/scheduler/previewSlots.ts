/**
 * Client-safe preview: generate slot datetimes from one or more rules for the next N days.
 * Mirrors generateSlots logic without DB; used for mini calendar previews in schedule UI.
 */

import { CronExpressionParser } from 'cron-parser';

const MAX_PREVIEW_SLOTS_PER_RULE = 100;
const PREVIEW_DAYS = 42;

type RuleConfig = Record<string, unknown>;

function parseTimeToMinutes(time: string): number {
	const t = String(time).trim().toLowerCase();
	const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
	if (match) {
		const h = parseInt(match[1], 10);
		const m = parseInt(match[2], 10);
		return h * 60 + m;
	}
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
	const minutes = parseTimeToMinutes(String(timeStr));
	const d = new Date(date);
	d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return d;
}

function timeToDateUTC(date: Date, timeStr: string): Date {
	const minutes = parseTimeToMinutes(String(timeStr));
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

export type PreviewRule = {
	type: string;
	config: RuleConfig;
	start_at: string | null;
	end_at: string | null;
};

function generateFromRule(
	rule: PreviewRule,
	fromDate: Date,
	endDate: Date,
	cap: number
): string[] {
	const config = rule.config;
	const start = rule.start_at ? new Date(rule.start_at) : fromDate;
	const end = rule.end_at ? new Date(rule.end_at) : endDate;
	const effectiveEnd = end > endDate ? endDate : end;
	const slots: string[] = [];
	const limit = Math.min(cap, MAX_PREVIEW_SLOTS_PER_RULE);

	switch (rule.type) {
		case 'once': {
			const at = config.at as string | undefined;
			if (!at) break;
			const d = new Date(at);
			if (d >= start && d <= effectiveEnd) slots.push(d.toISOString().slice(0, 19));
			break;
		}
		case 'cron': {
			let expr = (config.expression as string)?.trim();
			if (!expr) break;
			const parts = expr.split(/\s+/);
			if (parts.length === 5) expr = '0 ' + expr;
			try {
				const options: { currentDate?: Date; endDate?: Date } = { currentDate: start };
				options.endDate = effectiveEnd;
				const interval = CronExpressionParser.parse(expr, options);
				for (let i = 0; i < limit; i++) {
					const next = interval.next();
					const d = next.toDate();
					if (d > effectiveEnd) break;
					slots.push(d.toISOString().slice(0, 19));
				}
			} catch {
				// invalid cron
			}
			break;
		}
		case 'daily': {
			const time = (config.time as string) || '09:00';
			let d = timeToDate(start, time);
			if (d < start) d.setDate(d.getDate() + 1);
			for (let i = 0; i < limit; i++) {
				if (d > effectiveEnd) break;
				slots.push(d.toISOString().slice(0, 19));
				d.setDate(d.getDate() + 1);
			}
			break;
		}
		case 'weekly': {
			const dayOfWeek = (config.dayOfWeek as number) ?? 0;
			const time = (config.time as string) || '09:00';
			let d = timeToDateUTC(start, time);
			while (d.getUTCDay() !== dayOfWeek || d < start) {
				d.setUTCDate(d.getUTCDate() + 1);
				d = timeToDateUTC(d, time);
			}
			const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
			for (let i = 0; i < limit; i++) {
				if (d > effectiveEnd) break;
				slots.push(d.toISOString().slice(0, 19));
				d = new Date(d.getTime() + sevenDaysMs);
			}
			break;
		}
		case 'monthly': {
			const dayNum = Math.min(31, Math.max(1, (config.dayOfMonth as number) ?? 1));
			const time = (config.time as string) || '09:00';
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
			for (let i = 0; i < limit; i++) {
				if (d > effectiveEnd) break;
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
			const month = Math.min(12, Math.max(1, (config.month as number) ?? 1)) - 1;
			const dayNum = Math.min(31, Math.max(1, (config.dayOfMonth as number) ?? 1));
			const time = (config.time as string) || '09:00';
			let y = start.getFullYear();
			let d = new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate()));
			d = timeToDate(d, time);
			if (d < start) {
				y += 1;
				d = timeToDate(new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate())), time);
			}
			for (let i = 0; i < limit; i++) {
				if (d > effectiveEnd) break;
				slots.push(d.toISOString().slice(0, 19));
				y += 1;
				d = timeToDate(new Date(y, month, Math.min(dayNum, new Date(y, month + 1, 0).getDate())), time);
			}
			break;
		}
		case 'interval': {
			const amount = (config.amount as number) ?? 1;
			const unit = (config.unit as string) ?? 'hours';
			let d = new Date(start);
			for (let i = 0; i < limit; i++) {
				if (d > effectiveEnd) break;
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
 * Preview slot datetimes for a single rule for the next N days.
 */
export function previewSlotsForRule(rule: PreviewRule, fromDate?: Date, daysAhead: number = PREVIEW_DAYS): string[] {
	const from = fromDate ?? new Date();
	const end = new Date(from);
	end.setDate(end.getDate() + daysAhead);
	return generateFromRule(rule, from, end, MAX_PREVIEW_SLOTS_PER_RULE);
}

/**
 * Preview slot datetimes for all rules combined (merged, sorted, deduped) for the next N days.
 */
export function previewSlotsForRules(rules: PreviewRule[], fromDate?: Date, daysAhead: number = PREVIEW_DAYS): string[] {
	const from = fromDate ?? new Date();
	const end = new Date(from);
	end.setDate(end.getDate() + daysAhead);
	const all: string[] = [];
	for (const rule of rules) {
		all.push(...generateFromRule(rule, from, end, MAX_PREVIEW_SLOTS_PER_RULE));
	}
	all.sort();
	const seen = new Set<string>();
	return all.filter((s) => {
		if (seen.has(s)) return false;
		seen.add(s);
		return true;
	});
}
