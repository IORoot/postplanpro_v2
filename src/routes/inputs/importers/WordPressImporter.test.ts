import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import WordPressImporter from './WordPressImporter.svelte';

vi.mock('$app/forms', () => ({ enhance: () => () => {} }));

describe('WordPressImporter', () => {
	it('renders without crashing', () => {
		render(WordPressImporter, { props: { data: {}, form: {} } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders site URL or discover UI', () => {
		render(WordPressImporter, { props: { data: { webhooks: [], schedules: [] }, form: {} } });
		expect(document.body.textContent).toMatch(/WordPress|site|URL|discover/i);
	});
});
