/** Shared utilities for bulk-create importers. Used by each importer independently. */

export const FILTER_OPERATORS = [
	{ value: 'eq', label: 'equals', needsValue: true },
	{ value: 'neq', label: 'does not equal', needsValue: true },
	{ value: 'contains', label: 'contains', needsValue: true },
	{ value: 'not_contains', label: 'does not contain', needsValue: true },
	{ value: 'regex', label: 'matches regex', needsValue: true },
	{ value: 'not_regex', label: 'does not match regex', needsValue: true },
	{ value: 'array_contains', label: 'array contains', needsValue: true },
	{ value: 'array_not_contains', label: 'array does not contain', needsValue: true },
	{ value: 'null', label: 'is null', needsValue: false },
	{ value: 'not_null', label: 'is not null', needsValue: false },
	{ value: 'empty', label: 'is empty', needsValue: false },
	{ value: 'not_empty', label: 'is not empty', needsValue: false },
	{ value: 'exists', label: 'exists', needsValue: false },
	{ value: 'not_exists', label: 'does not exist', needsValue: false }
] as const;

export type CustomMapping = { path: string; key: string; type: string; unescapeNewlines?: boolean };
export type FilterRule = { path: string; operator: string; value: string };

export function sampleKeys(sample: unknown): string[] {
	if (sample == null || typeof sample !== 'object') return [];
	const keys: string[] = [];
	function walk(obj: unknown, prefix: string) {
		if (obj == null) return;
		if (Array.isArray(obj)) {
			obj.slice(0, 2).forEach((item, i) => walk(item, `${prefix}[${i}]`));
			return;
		}
		if (typeof obj === 'object') {
			for (const [k, v] of Object.entries(obj)) {
				const path = prefix ? `${prefix}.${k}` : k;
				keys.push(path);
				if (typeof v === 'object' && v !== null && !Array.isArray(v)) walk(v, path);
			}
		}
	}
	walk(sample, '');
	return keys;
}

const MAX_STRING_LENGTH = 400;

/** Build a copy of the sample with long strings truncated for readable preview. */
export function sampleForPreview(obj: unknown): unknown {
	if (obj == null) return obj;
	if (typeof obj === 'string') {
		return obj.length <= MAX_STRING_LENGTH ? obj : obj.slice(0, MAX_STRING_LENGTH) + '… [truncated]';
	}
	if (Array.isArray(obj)) {
		return obj.slice(0, 5).map(sampleForPreview);
	}
	if (typeof obj === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj)) {
			out[k] = sampleForPreview(v);
		}
		return out;
	}
	return obj;
}

export function filterRulesJson(combine: 'and' | 'or', rules: FilterRule[]): string {
	return JSON.stringify({
		combine,
		rules: rules.filter((r) => r.path.trim()).map((r) => ({ path: r.path.trim(), operator: r.operator, value: r.value?.trim() ?? '' }))
	});
}

export function customMappingJson(mappings: CustomMapping[]): string {
	return JSON.stringify(
		mappings.filter((m) => m.path.trim() && m.key.trim()).map((m) => ({
			path: m.path,
			key: m.key,
			type: m.type,
			unescapeNewlines: Boolean(m.unescapeNewlines)
		}))
	);
}
