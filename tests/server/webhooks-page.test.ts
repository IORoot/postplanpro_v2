/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { load, actions } from '../../src/routes/webhooks/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

vi.mock('$env/dynamic/private', () => ({
	env: { APP_BASE_URL: 'https://app.example.com/' }
}));

beforeAll(() => {
	resetTestDatabase('webhooks-page');
	seedCallbackTestData();
});

describe('webhooks/+page.server load', () => {
	it('exposes import and stage URLs when APP_BASE_URL is set', async () => {
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/webhooks') as Parameters<typeof load>[0]
		);
		expect(r.callbackUrl).toBe('https://app.example.com/api/callbacks/stage');
		expect(r.importCallbackUrl).toBe('https://app.example.com/api/callbacks/import');
	});
});

describe('webhooks/+page.server callback token actions', () => {
	it('generateCallbackToken updates user row', async () => {
		const res = await actions.generateCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.generateCallbackToken>>[0]);
		expect(res && 'token' in res && typeof (res as { token: string }).token).toBe('string');
		const tok = (res as { token: string }).token;
		const dbTok = (getDatabase().prepare('SELECT callback_token FROM user WHERE id = ?').get(TEST_USER_ID) as { callback_token: string })
			.callback_token;
		expect(dbTok).toBe(tok);
	});
});
