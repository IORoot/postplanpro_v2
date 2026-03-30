import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import RssImporter from './RssImporter.svelte';

vi.mock('$app/forms', () => ({ enhance: () => () => {} }));

describe('RssImporter', () => {
	it('renders without crashing', () => {
		render(RssImporter, { props: { data: {}, form: {} } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders feed URL or discover UI', () => {
		render(RssImporter, { props: { data: { webhooks: [], schedules: [] }, form: {} } });
		expect(document.body.textContent).toMatch(/RSS|feed|URL|discover/i);
	});
});
