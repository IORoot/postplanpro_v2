import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'postplan-theme';

function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const theme = writable<Theme>(getInitialTheme());

export function initTheme() {
	if (typeof window === 'undefined') return;
	const initial = getInitialTheme();
	applyTheme(initial);
	theme.set(initial);
	theme.subscribe((value) => {
		applyTheme(value);
		localStorage.setItem(STORAGE_KEY, value);
	});
}

export function toggleTheme() {
	theme.update((t) => (t === 'light' ? 'dark' : 'light'));
}
