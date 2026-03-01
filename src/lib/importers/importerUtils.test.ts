import { describe, it, expect } from 'vitest';
import {
	FILTER_OPERATORS,
	sampleKeys,
	sampleForPreview,
	filterRulesJson,
	customMappingJson,
	type FilterRule,
	type CustomMapping
} from './importerUtils.js';

describe('importerUtils', () => {
	describe('FILTER_OPERATORS', () => {
		it('exports a non-empty array of operators with value, label, needsValue', () => {
			expect(Array.isArray(FILTER_OPERATORS)).toBe(true);
			expect(FILTER_OPERATORS.length).toBeGreaterThan(0);
			for (const op of FILTER_OPERATORS) {
				expect(op).toHaveProperty('value');
				expect(op).toHaveProperty('label');
				expect(op).toHaveProperty('needsValue');
				expect(typeof op.needsValue).toBe('boolean');
			}
		});
	});

	describe('sampleKeys', () => {
		it('returns empty array for null or undefined', () => {
			expect(sampleKeys(null)).toEqual([]);
			expect(sampleKeys(undefined)).toEqual([]);
		});

		it('returns empty array for non-objects', () => {
			expect(sampleKeys(42)).toEqual([]);
			expect(sampleKeys('str')).toEqual([]);
			expect(sampleKeys(true)).toEqual([]);
		});

		it('returns top-level keys for flat object', () => {
			expect(sampleKeys({ a: 1, b: 2 })).toEqual(expect.arrayContaining(['a', 'b']));
			expect(sampleKeys({ a: 1, b: 2 }).length).toBe(2);
		});

		it('returns nested paths for nested objects', () => {
			const obj = { foo: { bar: 1 } };
			const keys = sampleKeys(obj);
			expect(keys).toContain('foo');
			expect(keys).toContain('foo.bar');
		});

		it('includes key for array property (nested array elements not walked from parent)', () => {
			const obj = { items: [{ x: 1 }, { y: 2 }] };
			const keys = sampleKeys(obj);
			expect(keys).toContain('items');
			// When sample is array at top level, index paths are produced
			const arrSample = [{ x: 1 }, { y: 2 }];
			const arrKeys = sampleKeys(arrSample);
			expect(arrKeys.some((k) => k.includes('[0]') || k.includes('[1]'))).toBe(true);
		});
	});

	describe('sampleForPreview', () => {
		it('returns null/undefined as-is', () => {
			expect(sampleForPreview(null)).toBe(null);
			expect(sampleForPreview(undefined)).toBe(undefined);
		});

		it('returns short string unchanged', () => {
			const s = 'hello';
			expect(sampleForPreview(s)).toBe(s);
		});

		it('truncates long strings with suffix', () => {
			const long = 'a'.repeat(500);
			const result = sampleForPreview(long) as string;
			expect(result.length).toBeLessThan(500);
			expect(result).toContain('… [truncated]');
		});

		it('limits array to 5 elements and recurses', () => {
			const arr = [1, 2, 3, 4, 5, 6, 7];
			const result = sampleForPreview(arr) as unknown[];
			expect(result).toHaveLength(5);
		});

		it('recurses into objects', () => {
			const obj = { a: { b: 'nested' } };
			const result = sampleForPreview(obj) as Record<string, unknown>;
			expect(result).toEqual({ a: { b: 'nested' } });
		});
	});

	describe('filterRulesJson', () => {
		it('returns JSON with combine and rules', () => {
			const rules: FilterRule[] = [{ path: 'title', operator: 'eq', value: 'x' }];
			const out = filterRulesJson('and', rules);
			const parsed = JSON.parse(out);
			expect(parsed.combine).toBe('and');
			expect(Array.isArray(parsed.rules)).toBe(true);
			expect(parsed.rules[0]).toEqual({ path: 'title', operator: 'eq', value: 'x' });
		});

		it('filters out rules with empty path', () => {
			const rules: FilterRule[] = [
				{ path: '  ', operator: 'eq', value: 'x' },
				{ path: 'title', operator: 'eq', value: 'y' }
			];
			const out = filterRulesJson('or', rules);
			const parsed = JSON.parse(out);
			expect(parsed.rules).toHaveLength(1);
			expect(parsed.rules[0].path).toBe('title');
		});

		it('trims path and value', () => {
			const rules: FilterRule[] = [{ path: '  title  ', operator: 'eq', value: '  v  ' }];
			const out = filterRulesJson('and', rules);
			const parsed = JSON.parse(out);
			expect(parsed.rules[0].path).toBe('title');
			expect(parsed.rules[0].value).toBe('v');
		});
	});

	describe('customMappingJson', () => {
		it('returns JSON array of mappings with path, key, type, unescapeNewlines', () => {
			const mappings: CustomMapping[] = [
				{ path: 'title', key: 'title', type: 'string' },
				{ path: 'body', key: 'content', type: 'string', unescapeNewlines: true }
			];
			const out = customMappingJson(mappings);
			const parsed = JSON.parse(out);
			expect(parsed).toHaveLength(2);
			expect(parsed[0]).toEqual({ path: 'title', key: 'title', type: 'string', unescapeNewlines: false });
			expect(parsed[1].unescapeNewlines).toBe(true);
		});

		it('filters out mappings with empty path or key', () => {
			const mappings: CustomMapping[] = [
				{ path: '', key: 'k', type: 'string' },
				{ path: 'p', key: '  ', type: 'string' },
				{ path: 'p', key: 'k', type: 'string' }
			];
			const out = customMappingJson(mappings);
			const parsed = JSON.parse(out);
			expect(parsed).toHaveLength(1);
		});
	});
});
