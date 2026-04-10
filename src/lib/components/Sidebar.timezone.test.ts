import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.svelte';

vi.mock('$app/stores', () => ({
	page: {
		subscribe: (fn: (v: unknown) => void) => {
			fn({
				data: {
					sidebarCalendar: { year: 2025, month: 2, markers: {} },
					session: { user: { name: 'Test', email: 'test@test.com' } },
					userTimezone: 'America/New_York'
				},
				url: { pathname: '/calendar' }
			});
			return () => {};
		}
	}
}));

describe('Sidebar timezone clock', () => {
	it('renders subtle system clock with timezone label', () => {
		render(Sidebar);
		expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
	});
});
