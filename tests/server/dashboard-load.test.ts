/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load } from '../../src/routes/+page.server';
import { getDatabase } from '$lib/db/index.js';
import { setTestDatabasePath, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';

beforeAll(() => {
	setTestDatabasePath();
	getDatabase();
	seedCallbackTestData();
});

describe('Dashboard load', () => {
	it('returns empty stats and arrays when no userId', async () => {
		const result = await load({
			params: {},
			route: { id: null },
			url: new URL('http://test/'),
			fetch: globalThis.fetch,
			getClientAddress: () => '',
			setHeaders: () => {},
			parent: async () => ({}),
			locals: { userId: null },
			depends: () => {},
			untrack: (fn) => fn()
		});
		expect(result.stats).toBeNull();
		expect(result.upcomingPosts).toEqual([]);
		expect(result.failedPosts).toEqual([]);
	});

	it('returns stats and arrays when userId is set', async () => {
		const result = await load({
			params: {},
			route: { id: null },
			url: new URL('http://test/'),
			fetch: globalThis.fetch,
			getClientAddress: () => '',
			setHeaders: () => {},
			parent: async () => ({}),
			locals: { userId: TEST_USER_ID },
			depends: () => {},
			untrack: (fn) => fn()
		});
		expect(result.stats).not.toBeNull();
		expect(result.stats).toHaveProperty('totalPosts');
		expect(result.stats).toHaveProperty('scheduleCount');
		expect(result.stats).toHaveProperty('webhookCount');
		expect(Array.isArray(result.upcomingPosts)).toBe(true);
		expect(Array.isArray(result.failedPosts)).toBe(true);
	});
});
