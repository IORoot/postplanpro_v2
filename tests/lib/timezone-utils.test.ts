/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
	isValidTimeZone,
	localDateTimeToUtcIso,
	utcIsoToLocalDateTime,
	isNaiveScheduledAt,
	monthKeyInTimeZoneFromUtc
} from '$lib/server/timezone.js';

describe('timezone helpers', () => {
	it('validates IANA timezones', () => {
		expect(isValidTimeZone('UTC')).toBe(true);
		expect(isValidTimeZone('America/New_York')).toBe(true);
		expect(isValidTimeZone('Not/AZone')).toBe(false);
	});

	it('converts local datetime to UTC ISO', () => {
		const utc = localDateTimeToUtcIso('2026-01-15T09:30', 'America/New_York');
		expect(utc).toBe('2026-01-15T14:30:00.000Z');
	});

	it('converts UTC ISO to local datetime', () => {
		const local = utcIsoToLocalDateTime('2026-07-01T08:00:00.000Z', 'Europe/London');
		expect(local?.dateTime).toBe('2026-07-01T09:00');
	});

	it('handles DST boundaries without throwing', () => {
		const springGap = localDateTimeToUtcIso('2026-03-08T02:30', 'America/New_York');
		expect(springGap).toMatch(/Z$/);
		const fallRepeat = localDateTimeToUtcIso('2026-11-01T01:30', 'America/New_York');
		expect(fallRepeat).toMatch(/Z$/);
	});

	it('detects naive scheduled_at formats', () => {
		expect(isNaiveScheduledAt('2026-01-15T09:00:00')).toBe(true);
		expect(isNaiveScheduledAt('2026-01-15T09:00:00Z')).toBe(false);
		expect(isNaiveScheduledAt('2026-01-15T09:00:00+01:00')).toBe(false);
	});

	it('computes month keys in timezone from UTC', () => {
		expect(monthKeyInTimeZoneFromUtc('2026-02-01T00:30:00.000Z', 'America/New_York')).toBe('2026-01');
		expect(monthKeyInTimeZoneFromUtc('2026-02-01T00:30:00.000Z', 'UTC')).toBe('2026-02');
	});
});
