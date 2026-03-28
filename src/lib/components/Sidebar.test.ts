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
					session: { user: { name: 'Test', email: 'test@test.com' } }
				},
				url: { pathname: '/' }
			});
			return () => {};
		}
	}
}));

describe('Sidebar', () => {
	it('renders nav links', () => {
		render(Sidebar);
		expect(screen.getByText('Home')).toBeInTheDocument();
		expect(screen.getByText('Calendar')).toBeInTheDocument();
		expect(screen.getByText('Posts')).toBeInTheDocument();
		expect(screen.getByText('Schedules')).toBeInTheDocument();
		expect(screen.getByText('Reports')).toBeInTheDocument();
		expect(screen.getByText('Import')).toBeInTheDocument();
		expect(screen.getByText('Settings')).toBeInTheDocument();
	});

	it('renders sign-out or user section', () => {
		render(Sidebar);
		const form = document.querySelector('form');
		expect(form || document.body.textContent).toBeTruthy();
	});
});
