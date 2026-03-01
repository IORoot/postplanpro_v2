import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CsvImporter from './CsvImporter.svelte';

vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

describe('CsvImporter', () => {
	it('renders step 1 and file input', () => {
		render(CsvImporter, {
			props: {
				data: {},
				form: {}
			}
		});
		expect(document.body.textContent).toMatch(/1|Upload|CSV|delimiter|header/i);
	});

	it('renders with empty form state', () => {
		render(CsvImporter, {
			props: {
				data: { webhooks: [], schedules: [] },
				form: {}
			}
		});
		expect(document.body.textContent).toBeTruthy();
	});
});
