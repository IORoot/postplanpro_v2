import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import SquarespaceImporter from './SquarespaceImporter.svelte';

vi.mock('$app/forms', () => ({ enhance: () => () => {} }));

describe('SquarespaceImporter', () => {
	it('renders without crashing', () => {
		render(SquarespaceImporter, { props: { data: {}, form: {} } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders blog URL or discover UI', () => {
		render(SquarespaceImporter, { props: { data: { webhooks: [], schedules: [] }, form: {} } });
		expect(document.body.textContent).toMatch(/Squarespace|blog|URL|discover/i);
	});
});
