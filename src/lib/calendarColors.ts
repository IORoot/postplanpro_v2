/** Shared palette for rule colours (calendar dots and rule card accents). */
export const RULE_COLORS = [
	'#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0d9488', '#ca8a04', '#be185d'
];

export function ruleColor(ruleIndex: number): string {
	return RULE_COLORS[ruleIndex % RULE_COLORS.length];
}
