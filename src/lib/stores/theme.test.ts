import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { theme, toggleTheme } from './theme.js';

describe('theme store', () => {
	it('has initial value', () => {
		const value = get(theme);
		expect(value === 'light' || value === 'dark').toBe(true);
	});

	it('toggleTheme flips light to dark and dark to light', () => {
		theme.set('light');
		toggleTheme();
		expect(get(theme)).toBe('dark');
		toggleTheme();
		expect(get(theme)).toBe('light');
	});
});
