/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load } from '../../src/routes/posts/+page.server';
import { getDatabase } from '$lib/db/index.js';
import { setTestDatabasePath, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';

beforeAll(() => {
	setTestDatabasePath('posts-load');
	getDatabase();
	seedCallbackTestData();
});

const mockEvent = (locals: { userId: string | null }, url = 'http://test/posts') => ({
	params: {},
	route: { id: null },
	url: new URL(url),
	fetch: globalThis.fetch,
	getClientAddress: () => '',
	setHeaders: () => {},
	parent: async () => ({}),
	locals,
	depends: () => {},
	untrack: (fn: () => void) => fn()
});

describe('Posts page load', () => {
	it('returns empty posts and filters when no userId', async () => {
		const result = await load(mockEvent({ userId: null }));
		expect(result.posts).toEqual([]);
		expect(result.filters).toBeDefined();
		expect(result.filters.status).toBe('');
	});

	it('returns posts and webhooks when userId is set', async () => {
		const result = await load(mockEvent({ userId: TEST_USER_ID }));
		expect(Array.isArray(result.posts)).toBe(true);
		expect(Array.isArray(result.webhooks)).toBe(true);
		expect(Array.isArray(result.schedules)).toBe(true);
		expect(result.filters).toHaveProperty('status');
	});
});
