import { writable, get } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'postplan-theme';

/** Synced from root layout on navigation — welcome + auth always use dark tokens. */
let pathnameForThemeMerge = '';

function forcePublicDarkShell(pathname: string): boolean {
	return pathname === '/' || pathname.startsWith('/welcome') || pathname.startsWith('/auth');
}

function applyHtmlDarkClass(themeValue: Theme) {
	if (typeof document === 'undefined') return;
	const forceDark = forcePublicDarkShell(pathnameForThemeMerge);
	document.documentElement.classList.toggle('dark', forceDark || themeValue === 'dark');
}

/** Call from root layout whenever the URL changes (client). */
export function setPathnameForThemeMerge(pathname: string) {
	pathnameForThemeMerge = pathname;
	applyHtmlDarkClass(get(theme));
}

function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(getInitialTheme());

export function initTheme() {
	if (typeof window === 'undefined') return;
	const initial = getInitialTheme();
	applyHtmlDarkClass(initial);
	theme.set(initial);
	theme.subscribe((value) => {
		applyHtmlDarkClass(value);
		localStorage.setItem(STORAGE_KEY, value);
	});
}

export function toggleTheme() {
	theme.update((t) => (t === 'light' ? 'dark' : 'light'));
}
