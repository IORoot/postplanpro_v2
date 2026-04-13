import { writable } from 'svelte/store';

/** localStorage key for input page animations (used by backup import/export UI). */
export const INPUT_ANIMATIONS_STORAGE_KEY = 'postplan-show-input-animations';
const ANIMATIONS_KEY = INPUT_ANIMATIONS_STORAGE_KEY;

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
