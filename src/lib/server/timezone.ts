const TZ_PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

const DEFAULT_TIMEZONE = 'Europe/London';

type ZonedParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
	const cached = TZ_PARTS_FORMATTER_CACHE.get(timeZone);
	if (cached) return cached;
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	TZ_PARTS_FORMATTER_CACHE.set(timeZone, fmt);
	return fmt;
}

function toZonedParts(date: Date, timeZone: string): ZonedParts {
	const parts = partsFormatter(timeZone).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((p) => p.type === type)?.value ?? '0');
	return {
		year: value('year'),
		month: value('month'),
		day: value('day'),
		hour: value('hour'),
		minute: value('minute'),
		second: value('second')
	};
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function normalizeLocalDateTime(localDateTime: string): string | null {
	const m = localDateTime
		.trim()
		.replace(' ', 'T')
		.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}`;
}

function parseLocalDateTime(localDateTime: string): ZonedParts | null {
	const normalized = normalizeLocalDateTime(localDateTime);
	if (!normalized) return null;
	const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
	if (!m) return null;
	return {
		year: Number(m[1]),
		month: Number(m[2]),
		day: Number(m[3]),
		hour: Number(m[4]),
		minute: Number(m[5]),
		second: Number(m[6])
	};
}

function getOffsetMinutes(date: Date, timeZone: string): number {
	const parts = toZonedParts(date, timeZone);
	const asUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return (asUtcMs - date.getTime()) / 60000;
}

/** Robust IANA timezone validation without throwing at call sites. */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
	if (!timeZone) return false;
	try {
		partsFormatter(timeZone);
		return true;
	} catch {
		return false;
	}
}

export function ensureValidTimeZone(timeZone: string | null | undefined): string {
	return isValidTimeZone(timeZone) ? (timeZone as string) : DEFAULT_TIMEZONE;
}

/** Return UTC ISO timestamp for a local date-time in the given IANA timezone. */
export function localDateTimeToUtcIso(localDateTime: string, timeZone: string): string | null {
	const p = parseLocalDateTime(localDateTime);
	if (!p) return null;
	const tz = ensureValidTimeZone(timeZone);
	// Treat local date-time as if it were UTC first, then correct by timezone offset.
	const localAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	let utcMs = localAsUtcMs;
	for (let i = 0; i < 4; i++) {
		const offsetMin = getOffsetMinutes(new Date(utcMs), tz);
		const candidate = localAsUtcMs - offsetMin * 60_000;
		if (candidate === utcMs) break;
		utcMs = candidate;
	}
	return new Date(utcMs).toISOString();
}

/** Convert UTC timestamp to local date-time pieces in the given IANA timezone. */
export function utcIsoToLocalDateTime(utcIso: string | null, timeZone: string): { date: string; time: string; dateTime: string } | null {
	if (!utcIso) return null;
	const date = new Date(utcIso);
	if (Number.isNaN(date.getTime())) return null;
	const p = toZonedParts(date, ensureValidTimeZone(timeZone));
	const d = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
	const t = `${pad2(p.hour)}:${pad2(p.minute)}`;
	return { date: d, time: t, dateTime: `${d}T${t}` };
}

/** Heuristic: legacy scheduled values had no timezone offset (naive local time). */
export function isNaiveScheduledAt(value: string | null): boolean {
	if (!value) return false;
	const v = value.trim();
	if (v.length === 0) return false;
	// ISO offset markers at end, e.g. Z or +01:00 / -0700
	if (/Z$/i.test(v)) return false;
	if (/[+-]\d{2}:?\d{2}$/.test(v)) return false;
	return /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?$/.test(v);
}

export function normalizeScheduledAtForStorage(value: string): string {
	return value.includes('T') ? value : value.replace(' ', 'T');
}

export function utcNowIso(): string {
	return new Date().toISOString();
}

/** Month key for limits/calendar according to user's timezone. */
export function monthKeyInTimeZoneFromUtc(utcIso: string | null, timeZone: string): string | null {
	const local = utcIsoToLocalDateTime(utcIso, timeZone);
	if (!local) return null;
	return local.date.slice(0, 7);
}

