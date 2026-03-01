import { describe, it, expect } from 'vitest';
import { previewSlotsForRule, previewSlotsForRules, type PreviewRule } from './previewSlots.js';

describe('previewSlots', () => {
	describe('previewSlotsForRule', () => {
		it('daily rule produces one slot per day at given time', () => {
			const from = new Date('2025-03-01T00:00:00Z');
			const rule: PreviewRule = {
				type: 'daily',
				config: { time: '09:00' },
				start_at: null,
				end_at: null
			};
			const slots = previewSlotsForRule(rule, from, 3);
			expect(slots.length).toBeGreaterThanOrEqual(3);
			expect(slots[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
		});

		it('once rule produces single slot when at is in range', () => {
			const from = new Date('2025-03-01T00:00:00Z');
			const rule: PreviewRule = {
				type: 'once',
				config: { at: '2025-03-02T14:00:00Z' },
				start_at: null,
				end_at: null
			};
			const slots = previewSlotsForRule(rule, from, 7);
			expect(slots).toHaveLength(1);
			expect(slots[0]).toContain('2025-03-02');
		});

		it('interval rule produces slots at interval', () => {
			const from = new Date('2025-03-01T00:00:00Z');
			const rule: PreviewRule = {
				type: 'interval',
				config: { amount: 1, unit: 'hours' },
				start_at: null,
				end_at: null
			};
			const slots = previewSlotsForRule(rule, from, 5);
			expect(slots.length).toBeGreaterThanOrEqual(5);
		});

		it('weekly rule produces slots on given day of week', () => {
			const from = new Date('2025-03-01T00:00:00Z'); // Saturday
			const rule: PreviewRule = {
				type: 'weekly',
				config: { dayOfWeek: 0, time: '10:00' }, // Sunday
				start_at: null,
				end_at: null
			};
			const slots = previewSlotsForRule(rule, from, 14);
			expect(slots.length).toBeGreaterThanOrEqual(1);
		});

		it('cron rule produces slots matching expression', () => {
			const from = new Date('2025-03-01T00:00:00Z');
			const rule: PreviewRule = {
				type: 'cron',
				config: { expression: '0 9 * * *' }, // 09:00 daily
				start_at: null,
				end_at: null
			};
			const slots = previewSlotsForRule(rule, from, 7);
			expect(slots.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('previewSlotsForRules', () => {
		it('merges and dedupes multiple rules', () => {
			const from = new Date('2025-03-01T00:00:00Z');
			const rules: PreviewRule[] = [
				{ type: 'daily', config: { time: '09:00' }, start_at: null, end_at: null },
				{ type: 'daily', config: { time: '10:00' }, start_at: null, end_at: null }
			];
			const slots = previewSlotsForRules(rules, from, 3);
			expect(slots.length).toBeGreaterThanOrEqual(2);
			const unique = new Set(slots);
			expect(unique.size).toBe(slots.length);
		});
	});
});
