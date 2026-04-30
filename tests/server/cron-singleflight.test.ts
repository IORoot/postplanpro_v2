/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { setTestDatabasePath, seedCallbackTestData } from '../helpers/testDb.js';
import { getDatabase } from '$lib/db/index.js';

const CRON_SECRET = 'cron-singleflight-secret';

vi.mock('$env/dynamic/private', () => ({
	env: { CRON_SECRET }
}));

const sendCalls: { count: number; release?: () => void } = { count: 0 };

vi.mock('$lib/scheduler/sendDuePosts.js', () => ({
	sendDuePosts: vi.fn().mockImplementation(
		() =>
			new Promise<{ sent: number; failed: number; errors: string[] }>((resolve) => {
				sendCalls.count++;
				sendCalls.release = () => resolve({ sent: 0, failed: 0, errors: [] });
			})
	)
}));

const { GET } = await import('../../src/routes/api/cron/send-due-posts/+server');
const { resetSendLockForTesting } = await import('$lib/scheduler/cronLock.js');

beforeAll(() => {
	setTestDatabasePath('cron-singleflight');
	getDatabase();
	seedCallbackTestData();
	resetSendLockForTesting();
});

describe('cron single-flight guard', () => {
	it('second concurrent cron request is skipped while first is in flight', async () => {
		sendCalls.count = 0;
		sendCalls.release = undefined;

		const requestA = new Request('http://test/api/cron/send-due-posts', {
			method: 'GET',
			headers: { 'x-cron-secret': CRON_SECRET }
		});
		const requestB = new Request('http://test/api/cron/send-due-posts', {
			method: 'GET',
			headers: { 'x-cron-secret': CRON_SECRET }
		});

		const aPromise = GET({ request: requestA, url: new URL(requestA.url) });
		// Yield once so the first call enters sendDuePosts before the second starts.
		await new Promise((r) => setTimeout(r, 10));
		const bResponse = await GET({ request: requestB, url: new URL(requestB.url) });

		expect(bResponse.status).toBe(200);
		const bBody = (await bResponse.json()) as { skipped?: boolean; reason?: string };
		expect(bBody.skipped).toBe(true);

		// First call must still be the only sendDuePosts invocation.
		expect(sendCalls.count).toBe(1);

		sendCalls.release?.();
		const aResponse = await aPromise;
		expect(aResponse.status).toBe(200);
	});
});
