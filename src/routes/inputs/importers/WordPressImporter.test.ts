import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import WordPressImporter from './WordPressImporter.svelte';

vi.mock('$app/forms', () => ({ enhance: () => () => {} }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

describe('WordPressImporter', () => {
	it('renders without crashing', () => {
		render(WordPressImporter, { props: { data: {}, form: {} } });
		expect(document.body.textContent).toBeTruthy();
	});

	it('renders site URL or discover UI', () => {
		render(WordPressImporter, { props: { data: { webhooks: [], schedules: [] }, form: {} } });
		expect(document.body.textContent).toMatch(/WordPress|site|URL|discover/i);
	});

	it('stacks steps 3–6: filters, range, destination unlock in order', async () => {
		render(WordPressImporter, {
			props: {
				data: { webhooks: [], schedules: [] },
				form: { fetched: true, sample: { title: { rendered: 'x' } }, post_type_route: '/wp/v2/posts' }
			}
		});
		expect(screen.getByRole('heading', { level: 2, name: '3. Map fields' })).toBeTruthy();
		expect(screen.queryByRole('heading', { level: 2, name: '4. Import filters' })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: /Continue to import filters/i }));
		expect(screen.getByRole('heading', { level: 2, name: '4. Import filters' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: /Continue to import range/i }));
		expect(screen.getByRole('heading', { level: 2, name: '5. Import range' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: /Continue to destination/i }));
		expect(screen.getByRole('heading', { level: 2, name: '6. Destination and after import' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: '3. Map fields' })).toBeTruthy();
	});
});
