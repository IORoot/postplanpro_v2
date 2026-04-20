import { onMount } from 'svelte';

/** Tailwind `md` — diagrams stay closed below this unless user opens them. */
const MD_UP = '(min-width: 768px)';

/**
 * Diagram sections start closed (SSR-safe). Once mounted, opens when viewport is md+.
 * No `matchMedia` listener — avoids overwriting after the user toggles a diagram.
 */
export function syncDiagramDefaultWithViewport(setOpen: (open: boolean) => void): void {
	onMount(() => {
		setOpen(window.matchMedia(MD_UP).matches);
	});
}
