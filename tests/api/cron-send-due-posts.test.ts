/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import { setTestDatabasePath, seedCallbackTestData } from '../helpers/testDb.js';

const CRON_SECRET = 'test-cron-secret';

vi.mock('$env/dynamic/private', () => ({
	env: { CRON_SECRET }
}));

const { GET } = await import('../../src/routes/api/cron/send-due-posts/+server');

beforeAll(() => {
	setTestDatabasePath('cron-send-due-posts');
	getDatabase();
	seedCallbackTestData();
});

describe('GET /api/cron/send-due-posts', () => {
	it('returns 401 when no x-cron-secret', async () => {
		const request = new Request('http://test/api/cron/send-due-posts', { method: 'GET' });
		const response = await GET({ request, url: new URL(request.url) });
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toMatch(/Unauthorized/i);
	});

	it('returns 401 when secret is wrong', async () => {
		const request = new Request('http://test/api/cron/send-due-posts', {
			method: 'GET',
			headers: { 'x-cron-secret': 'wrong' }
		});
		const response = await GET({ request, url: new URL(request.url) });
		expect(response.status).toBe(401);
	});

	it('returns 200 when secret matches header', async () => {
		const request = new Request('http://test/api/cron/send-due-posts', {
			method: 'GET',
			headers: { 'x-cron-secret': CRON_SECRET }
		});
		const response = await GET({ request, url: new URL(request.url) });
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toBeDefined();
	});

	it('returns 401 when secret is provided only in query param', async () => {
		const request = new Request(`http://test/api/cron/send-due-posts?secret=${CRON_SECRET}`, {
			method: 'GET'
		});
		const response = await GET({ request, url: new URL(request.url) });
		expect(response.status).toBe(401);
	});
});
