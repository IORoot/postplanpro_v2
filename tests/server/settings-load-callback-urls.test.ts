/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { load } from '../../src/routes/settings/+page.server.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

vi.mock('$env/dynamic/private', () => ({
	env: { APP_BASE_URL: 'https://app.example.com/' }
}));

beforeAll(() => {
	resetTestDatabase('settings-load-env');
	seedCallbackTestData();
});

describe('settings/+page.server load callback URLs', () => {
	it('exposes callback and import URLs when APP_BASE_URL is set', async () => {
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/settings?section=imports') as Parameters<typeof load>[0]
		);
		expect(r.callbackUrl).toBe('https://app.example.com/api/callbacks/stage');
		expect(r.importCallbackUrl).toBe('https://app.example.com/api/callbacks/import');
		expect(r.section).toBe('inputs');
	});
});
