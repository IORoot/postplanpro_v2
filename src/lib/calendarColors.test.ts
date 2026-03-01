import { describe, it, expect } from 'vitest';
import { RULE_COLORS, ruleColor } from './calendarColors.js';

describe('calendarColors', () => {
	it('RULE_COLORS is non-empty array of hex strings', () => {
		expect(Array.isArray(RULE_COLORS)).toBe(true);
		expect(RULE_COLORS.length).toBeGreaterThan(0);
		for (const c of RULE_COLORS) {
			expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});

	it('ruleColor returns color by index (wraps with modulo)', () => {
		expect(ruleColor(0)).toBe(RULE_COLORS[0]);
		expect(ruleColor(1)).toBe(RULE_COLORS[1]);
		expect(ruleColor(RULE_COLORS.length)).toBe(RULE_COLORS[0]);
		expect(ruleColor(RULE_COLORS.length + 1)).toBe(RULE_COLORS[1]);
	});
});
