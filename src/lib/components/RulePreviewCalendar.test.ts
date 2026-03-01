import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import RulePreviewCalendar from './RulePreviewCalendar.svelte';

describe('RulePreviewCalendar', () => {
	it('renders without crashing with empty slots', () => {
		render(RulePreviewCalendar, { props: { slots: [] } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders with slot data', () => {
		const slots = ['2025-03-01T09:00:00', '2025-03-02T09:00:00'];
		render(RulePreviewCalendar, { props: { slots } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders with slotSeries (multi-rule)', () => {
		render(RulePreviewCalendar, {
			props: { slotSeries: [['2025-03-01T09:00:00'], ['2025-03-02T10:00:00']] }
		});
		expect(document.body.textContent).toBeTruthy();
	});
});
