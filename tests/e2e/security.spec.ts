import { test, expect } from '@playwright/test';

test.describe('Security', () => {
	test('cron endpoint returns 401 without secret', async ({ request }) => {
		const response = await request.get('/api/cron/send-due-posts');
		expect(response.status()).toBe(401);
	});

	test('callback import returns 401 without token', async ({ request }) => {
		const response = await request.post('/api/callbacks/import', {
			headers: { 'Content-Type': 'application/json' },
			data: { posts: [] }
		});
		expect(response.status()).toBe(401);
	});

	test('callback stage returns 401 without token', async ({ request }) => {
		const response = await request.post('/api/callbacks/stage', {
			headers: { 'Content-Type': 'application/json' },
			data: { post_id: 'any', stage_passed: 'x' }
		});
		expect(response.status()).toBe(401);
	});
});
