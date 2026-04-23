/** Default post colour when none is set (e.g. new posts). Tailwind neutral-50. */
export const DEFAULT_POST_COLOR = '#fafafa';

/** Light grey background when a post is created manually without a colour selected. Tailwind neutral-100. */
export const DEFAULT_MANUAL_POST_COLOR = '#f5f5f5';

export const TAILWIND_POST_COLORS = [
	'#f87171', // red-400
	'#fb923c', // orange-400
	'#fbbf24', // amber-400
	'#facc15', // yellow-400
	'#4ade80', // green-400
	'#2dd4bf', // teal-400
	'#22d3ee', // cyan-400
	'#60a5fa', // blue-400
	'#818cf8', // indigo-400
	'#a78bfa', // violet-400
	'#c084fc', // purple-400
	'#f472b6' // pink-400
] as const;

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizePostColor(value: string | null | undefined): string | null {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return null;
	if (!HEX_COLOR_RE.test(trimmed)) return null;
	return trimmed.toLowerCase();
}

export function randomTailwindPostColor(): string {
	const index = Math.floor(Math.random() * TAILWIND_POST_COLORS.length);
	return TAILWIND_POST_COLORS[index];
}
