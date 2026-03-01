/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { GET } from '../../src/routes/api/sidebar-calendar/+server';
import { getDatabase } from '$lib/db/index.js';
import { setTestDatabasePath, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';

beforeAll(() => {
	setTestDatabasePath();
	getDatabase();
	seedCallbackTestData();
});

describe('GET /api/sidebar-calendar', () => {
	it('returns 401 when no session', async () => {
		const request = new Request('http://test/api/sidebar-calendar', { method: 'GET' });
		const response = await GET({
			request,
			url: new URL(request.url),
			params: {},
			locals: { userId: null }
		});
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toMatch(/Unauthorized/i);
	});

	it('returns 200 with year and month and markers when session present', async () => {
		const request = new Request('http://test/api/sidebar-calendar?year=2025&month=2', {
			method: 'GET'
		});
		const response = await GET({
			request,
			url: new URL(request.url),
			params: {},
			locals: { userId: TEST_USER_ID }
		});
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.year).toBe(2025);
		expect(data.month).toBe(2);
		expect(typeof data.markers).toBe('object');
	});
});
