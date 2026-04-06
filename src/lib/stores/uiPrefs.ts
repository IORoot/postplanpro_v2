import { writable } from 'svelte/store';

const ANIMATIONS_KEY = 'postplan-show-input-animations';

function getInitialShowAnimations(): boolean {
	if (typeof window === 'undefined') return true;
	const stored = localStorage.getItem(ANIMATIONS_KEY);
	return stored === null ? true : stored === 'true';
}

export const showInputAnimations = writable<boolean>(getInitialShowAnimations());

export function initUiPrefs() {
	if (typeof window === 'undefined') return;
	showInputAnimations.set(getInitialShowAnimations());
	showInputAnimations.subscribe((value) => {
		localStorage.setItem(ANIMATIONS_KEY, String(value));
	});
}

export function toggleInputAnimations() {
	showInputAnimations.update((v) => !v);
}
