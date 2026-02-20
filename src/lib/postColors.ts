export const TAILWIND_POST_COLORS = [
	'#fee2e2', // red-100
	'#ffedd5', // orange-100
	'#fef3c7', // amber-100
	'#fef9c3', // yellow-100
	'#dcfce7', // green-100
	'#ccfbf1', // teal-100
	'#cffafe', // cyan-100
	'#dbeafe', // blue-100
	'#e0e7ff', // indigo-100
	'#ede9fe', // violet-100
	'#f3e8ff', // purple-100
	'#fce7f3' // pink-100
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
