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
					sidebarPlanUsage: {
						posts: { used: 14, limit: 20 },
						imports: { used: 3, limit: 100 },
						callbacks: { used: 1, limit: 100 }
					},
					userTier: 'free',
					session: { user: { name: 'Test', email: 'test@test.com' } }
				},
				url: { pathname: '/calendar' }
			});
			return () => {};
		}
	}
}));

describe('Sidebar', () => {
	it('renders nav links', () => {
		render(Sidebar);
		expect(screen.getByText('Calendar')).toBeInTheDocument();
		expect(screen.getByText('Posts')).toBeInTheDocument();
		expect(screen.getByText('Schedules')).toBeInTheDocument();
		expect(screen.getByText('Reports')).toBeInTheDocument();
		expect(screen.getByText('Inputs')).toBeInTheDocument();
		expect(screen.getByText('Outputs')).toBeInTheDocument();
	});

	it('renders user section when signed in', () => {
		render(Sidebar);
		expect(screen.getByText('test@test.com')).toBeInTheDocument();
	});

	it('renders plan usage pills above mini calendar', () => {
		render(Sidebar);
		const billing = screen.getByRole('link', { name: /Monthly plan usage/i });
		expect(billing).toBeInTheDocument();
		expect(billing.textContent).toMatch(/14\s*\/\s*20/);
		expect(billing.textContent).toMatch(/3\s*\/\s*100/);
		expect(billing.textContent).toMatch(/1\s*\/\s*100/);
		expect(billing.textContent).toMatch(/posts/);
		expect(billing.textContent).toMatch(/imports/);
		expect(billing.textContent).toMatch(/callbacks/);
	});

	it('renders free-tier upgrade CTA above profile', () => {
		render(Sidebar);
		expect(screen.getByRole('link', { name: 'Upgrade to Pro' })).toHaveAttribute('href', '/api/stripe/checkout');
		expect(screen.getByRole('link', { name: 'View usage' })).toHaveAttribute('href', '/account?section=billing');
	});
});
