import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	DEFAULT_POST_COLOR,
	TAILWIND_POST_COLORS,
	normalizePostColor,
	randomTailwindPostColor
} from './postColors.js';

describe('postColors', () => {
	it('DEFAULT_POST_COLOR is hex string', () => {
		expect(DEFAULT_POST_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('TAILWIND_POST_COLORS is non-empty', () => {
		expect(Array.isArray(TAILWIND_POST_COLORS)).toBe(true);
		expect(TAILWIND_POST_COLORS.length).toBeGreaterThan(0);
	});

	describe('normalizePostColor', () => {
		it('returns null for empty or whitespace', () => {
			expect(normalizePostColor('')).toBe(null);
			expect(normalizePostColor('   ')).toBe(null);
			expect(normalizePostColor(null)).toBe(null);
			expect(normalizePostColor(undefined)).toBe(null);
		});

		it('returns lowercase hex for valid 6-char hex', () => {
			expect(normalizePostColor('#AbCdEf')).toBe('#abcdef');
			expect(normalizePostColor('#ffffff')).toBe('#ffffff');
		});

		it('returns null for invalid format', () => {
			expect(normalizePostColor('red')).toBe(null);
			expect(normalizePostColor('#fff')).toBe(null);
			expect(normalizePostColor('#1234567')).toBe(null);
		});
	});

	describe('randomTailwindPostColor', () => {
		beforeEach(() => {
			vi.spyOn(Math, 'random').mockReturnValue(0.5);
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('returns one of TAILWIND_POST_COLORS', () => {
			const c = randomTailwindPostColor();
			expect(TAILWIND_POST_COLORS).toContain(c);
		});
	});
});
