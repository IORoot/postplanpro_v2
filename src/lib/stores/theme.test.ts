import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { theme, toggleTheme, initTheme } from './theme.js';

describe('theme store', () => {
	beforeEach(() => {
		localStorage.removeItem('postplan-theme');
		document.documentElement.classList.remove('dark');
	});

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

	it('initTheme syncs store, DOM class, and localStorage', () => {
		localStorage.setItem('postplan-theme', 'dark');
		initTheme();
		expect(get(theme)).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});
});
