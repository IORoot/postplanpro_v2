import { describe, it, expect } from 'vitest';
import { parseValue, setByPath, buildPostPayload } from './payload.js';

describe('payload', () => {
	describe('parseValue', () => {
		it('returns null or empty as-is', () => {
			expect(parseValue('string', null)).toBeNull();
			expect(parseValue('string', '')).toBe('');
		});
		it('parses number, boolean, json, default string', () => {
			expect(parseValue('number', '42')).toBe(42);
			expect(parseValue('boolean', 'true')).toBe(true);
			expect(parseValue('boolean', '1')).toBe(true);
			expect(parseValue('boolean', 'false')).toBe(false);
			expect(parseValue('json', '{"a":1}')).toEqual({ a: 1 });
			expect(parseValue('json', 'not-json')).toBe('not-json');
			expect(parseValue('string', 'x')).toBe('x');
		});
	});

	describe('setByPath', () => {
		it('no-ops for empty path', () => {
			const o: Record<string, unknown> = { a: 1 };
			setByPath(o, '   ', 'x');
			setByPath(o, '', 'x');
			expect(o).toEqual({ a: 1 });
		});
		it('sets nested object keys', () => {
			const o: Record<string, unknown> = {};
			setByPath(o, 'meta.author', 'Ann');
			expect(o).toEqual({ meta: { author: 'Ann' } });
		});
		it('sets array index paths', () => {
			const o: Record<string, unknown> = { tags: [] };
			setByPath(o, 'tags[0]', 'a');
			expect(o.tags).toEqual(['a']);
		});
		it('returns early when array segment invalid', () => {
			const o: Record<string, unknown> = {};
			setByPath(o, '[0]', 'x');
			expect(o).toEqual({});
		});

	});

	describe('buildPostPayload', () => {
		it('merges base, post fields, and globals', () => {
			const body = buildPostPayload(
				{ title: 'T', content: 'c', image_url: null, scheduled_at: null },
				[{ key: 'extra', type: 'number', value: '3' }],
				[{ key: 'g', type: 'string', value: 'gv' }]
			);
			expect(body.title).toBe('T');
			expect(body.content).toBe('c');
			expect(body.extra).toBe(3);
			expect(body.g).toBe('gv');
		});
	});
});
