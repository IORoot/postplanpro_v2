/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { load, actions } from '../../src/routes/inputs/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID } from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

vi.mock('$env/dynamic/private', () => ({
	env: { APP_BASE_URL: 'https://app.example.com/' }
}));

beforeAll(() => {
	resetTestDatabase('inputs-load-env');
	seedCallbackTestData();
});

describe('inputs/+page.server load callback URLs', () => {
	it('exposes callback and import URLs when APP_BASE_URL is set', async () => {
		const r = await load(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/inputs?section=callbacks') as Parameters<typeof load>[0]
		);
		expect(r.callbackUrl).toBe('https://app.example.com/api/callbacks/stage');
		expect(r.importCallbackUrl).toBe('https://app.example.com/api/callbacks/import');
		expect(r.section).toBe('callbacks');
	});
});

describe('inputs/+page.server callback token actions', () => {
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

	it('revokeCallbackToken clears token', async () => {
		await actions.generateCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.generateCallbackToken>>[0]);
		await actions.revokeCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.revokeCallbackToken>>[0]);
		const t = (getDatabase().prepare('SELECT callback_token FROM user WHERE id = ?').get(TEST_USER_ID) as { callback_token: string | null })
			.callback_token;
		expect(t).toBeNull();
	});
});
